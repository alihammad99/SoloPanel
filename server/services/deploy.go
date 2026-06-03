package services

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/panel/backend/config"
	"github.com/panel/backend/db"
)

// ── Log Streamer ──────────────────────────────────────────────────────────────

type LogStreamer struct {
	mu    sync.Mutex
	lines []string
	subs  []chan string
	done  bool
}

func NewLogStreamer() *LogStreamer { return &LogStreamer{} }

func (ls *LogStreamer) Write(p []byte) (n int, err error) {
	ls.mu.Lock()
	defer ls.mu.Unlock()
	line := string(p)
	ls.lines = append(ls.lines, line)
	for _, ch := range ls.subs {
		select {
		case ch <- line:
		default:
		}
	}
	return len(p), nil
}

func (ls *LogStreamer) Subscribe() chan string {
	ch := make(chan string, 256)
	ls.mu.Lock()
	for _, l := range ls.lines {
		ch <- l
	}
	if ls.done {
		close(ch)
	} else {
		ls.subs = append(ls.subs, ch)
	}
	ls.mu.Unlock()
	return ch
}

func (ls *LogStreamer) Done() {
	ls.mu.Lock()
	defer ls.mu.Unlock()
	ls.done = true
	for _, ch := range ls.subs {
		close(ch)
	}
	ls.subs = nil
}

func (ls *LogStreamer) FullLog() string {
	ls.mu.Lock()
	defer ls.mu.Unlock()
	return strings.Join(ls.lines, "")
}

// ── Active streamers & cancel map ─────────────────────────────────────────────

var activeStreamers sync.Map // deployID → *LogStreamer
var cancelFuncs sync.Map     // appID    → context cancel func

func GetStreamer(deployID uint) *LogStreamer {
	if v, ok := activeStreamers.Load(deployID); ok {
		return v.(*LogStreamer)
	}
	return nil
}

// CancelDeploy signals the running deploy for appID to abort.
func CancelDeploy(appID uint) {
	if v, ok := cancelFuncs.Load(appID); ok {
		v.(func())()
	}
}

// ── Process manager ───────────────────────────────────────────────────────────

var procMu sync.Mutex
var procMap = map[uint]*exec.Cmd{} // appID → running process

func startProcess(app *db.App, dir string, ls *LogStreamer) error {
	stopProcess(app.ID) // kill previous instance if any

	startCmd := app.StartCmd
	if startCmd == "" {
		return nil // static site: nothing to start
	}
	startCmd = replacePlaceholders(startCmd, app)

	// Verify the port is not taken by another running process
	if app.Port > 0 {
		ln, err := net.Listen("tcp", fmt.Sprintf(":%d", app.Port))
		if err != nil {
			return fmt.Errorf("port %d is already in use by another process", app.Port)
		}
		ln.Close()
	}

	// For docker run commands, clean up any existing container with the same name
	if strings.Contains(startCmd, "docker run") {
		exec.Command("docker", "stop", app.Name).Run()
		exec.Command("docker", "rm", "-f", app.Name).Run()
	}

	envMap := buildEnvMap(app)

	cmd := exec.Command("sh", "-c", startCmd)
	cmd.Dir = dir
	cmd.Env = os.Environ()
	for k, v := range envMap {
		cmd.Env = append(cmd.Env, k+"="+v)
	}
	// New process group so we can kill all children
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start process: %w", err)
	}

	procMu.Lock()
	procMap[app.ID] = cmd
	procMu.Unlock()

	pid := cmd.Process.Pid
	db.DB.Model(&db.App{}).Where("id = ?", app.ID).Updates(map[string]interface{}{
		"status": "running",
		"pid":    pid,
	})
	if ls != nil {
		ls.Write([]byte(fmt.Sprintf("[process] started PID %d\n", pid)))
	}

	// Watch for exit and update status
	go func() {
		cmd.Wait()
		procMu.Lock()
		if procMap[app.ID] == cmd {
			delete(procMap, app.ID)
		}
		procMu.Unlock()
		db.DB.Model(&db.App{}).Where("id = ?", app.ID).Updates(map[string]interface{}{
			"status": "idle",
			"pid":    0,
		})
	}()

	return nil
}

func stopProcess(appID uint) {
	procMu.Lock()
	cmd, ok := procMap[appID]
	delete(procMap, appID)
	procMu.Unlock()
	if !ok || cmd.Process == nil {
		return
	}
	// Kill entire process group
	syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
	done := make(chan struct{})
	go func() { cmd.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
}

func StopApp(appID uint) {
	var app db.App
	if db.DB.First(&app, appID).Error == nil {
		// Stop Docker container if applicable (best-effort)
		if app.TechStack == "docker" {
			exec.Command("docker", "stop", app.Name).Run()
			exec.Command("docker", "rm", "-f", app.Name).Run()
		}
		if app.PreviewSlug != "" {
			if ip := GetPublicIP(); ip != "" {
				RemoveDomain(PreviewDomain(app.PreviewSlug, ip))
			}
		}
	}
	stopProcess(appID)
	db.DB.Model(&db.App{}).Where("id = ?", appID).Updates(map[string]interface{}{
		"status": "idle",
		"pid":    0,
	})
}

// ── Rollback ──────────────────────────────────────────────────────────────────

func RollbackApp(app *db.App, ls *LogStreamer) error {
	appDir := filepath.Join(config.C.Storage.AppsDir, app.Name)
	prevDir := appDir + ".prev"

	if _, err := os.Stat(prevDir); os.IsNotExist(err) {
		return fmt.Errorf("no previous build available to roll back to")
	}

	logf := makeLogf(ls)
	logf("Rolling back to previous build…")

	stopProcess(app.ID)

	// current → .bad, prev → current
	badDir := appDir + ".bad"
	os.RemoveAll(badDir)
	if _, err := os.Stat(appDir); err == nil {
		if err := os.Rename(appDir, badDir); err != nil {
			return fmt.Errorf("archive current build: %w", err)
		}
	}
	if err := os.Rename(prevDir, appDir); err != nil {
		os.Rename(badDir, appDir) // restore
		return fmt.Errorf("swap back failed: %w", err)
	}

	logf("Rollback complete — starting previous process")
	if err := startProcess(app, appDir, ls); err != nil {
		logf("Warning: process start failed: %v", err)
	}
	return nil
}

// ── Main deploy ───────────────────────────────────────────────────────────────

func RunDeploy(app *db.App, deployID uint, _ string, _ string) {
	// Concurrent deploy guard
	if _, loaded := cancelFuncs.LoadOrStore(app.ID, func() {}); loaded {
		ls := NewLogStreamer()
		activeStreamers.Store(deployID, ls)
		ls.Write([]byte("[error] another deployment is already running for this app\n"))
		failDeployFull(app.ID, deployID, ls, nil, time.Now(), "concurrent deploy rejected")
		activeStreamers.Delete(deployID)
		return
	}

	cancelled := false
	cancelFuncs.Store(app.ID, func() { cancelled = true })
	defer cancelFuncs.Delete(app.ID)

	ls := NewLogStreamer()
	activeStreamers.Store(deployID, ls)
	defer func() {
		ls.Done()
		activeStreamers.Delete(deployID)
	}()

	logf := makeLogf(ls)
	deployStart := time.Now()

	// Phase tracker
	phases := []db.DeployPhase{
		{Name: "clone", Status: "pending"},
		{Name: "install", Status: "pending"},
		{Name: "build", Status: "pending"},
		{Name: "start", Status: "pending"},
	}

	savePhases := func() {
		b, _ := json.Marshal(phases)
		db.DB.Model(&db.Deployment{}).Where("id = ?", deployID).Update("phases", string(b))
	}

	phaseStart := func(name string) time.Time {
		for i := range phases {
			if phases[i].Name == name {
				phases[i].Status = "running"
				phases[i].StartedAt = time.Now().UnixMilli()
			}
		}
		savePhases()
		logf("=== %s ===", strings.ToUpper(name))
		return time.Now()
	}

	phaseEnd := func(name string, t time.Time, err error) {
		for i := range phases {
			if phases[i].Name == name {
				phases[i].Duration = time.Since(t).Milliseconds()
				if err != nil {
					phases[i].Status = "failed"
				} else {
					phases[i].Status = "success"
				}
			}
		}
		savePhases()
	}

	phaseSkip := func(name string) {
		for i := range phases {
			if phases[i].Name == name {
				phases[i].Status = "skipped"
			}
		}
		savePhases()
	}

	db.DB.Model(&db.Deployment{}).Where("id = ?", deployID).Updates(map[string]interface{}{
		"status":     "building",
		"started_at": deployStart,
		"branch":     app.Branch,
	})
	db.DB.Model(&db.App{}).Where("id = ?", app.ID).Updates(map[string]interface{}{
		"status":           "building",
		"active_deploy_id": deployID,
	})

	appDir := filepath.Join(config.C.Storage.AppsDir, app.Name)
	stageDir := appDir + ".staging"
	prevDir := appDir + ".prev"

	logf("Deploying %s @ %s", app.Name, app.Branch)

	// ── SSH key setup ──────────────────────────────────────────────────────────
	var sshEnv []string
	if app.DeployKeyPriv != "" {
		os.MkdirAll(config.C.Storage.KeysDir, 0700)
		keyPath := filepath.Join(config.C.Storage.KeysDir, fmt.Sprintf("app_%d", app.ID))
		privKey := app.DeployKeyPriv
		if config.C.Encryption.Key != "" {
			if dec, err := Decrypt(privKey, config.C.Encryption.Key); err == nil {
				privKey = dec
			}
		}
		if err := os.WriteFile(keyPath, []byte(privKey), 0600); err != nil {
			failDeployFull(app.ID, deployID, ls, phases, deployStart, fmt.Sprintf("write deploy key: %v", err))
			return
		}
		sshEnv = []string{fmt.Sprintf(
			"GIT_SSH_COMMAND=ssh -i %s -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes",
			keyPath,
		)}
	}

	// ── Phase: clone / pull ────────────────────────────────────────────────────
	if cancelled {
		failDeployFull(app.ID, deployID, ls, phases, deployStart, "cancelled")
		return
	}
	t := phaseStart("clone")
	gitDir := filepath.Join(stageDir, ".git")
	if _, err := os.Stat(stageDir); err == nil {
		if _, err2 := os.Stat(gitDir); os.IsNotExist(err2) {
			os.RemoveAll(stageDir)
		}
	}
	if _, err := os.Stat(stageDir); os.IsNotExist(err) {
		logf("Cloning %s", app.RepoURL)
		if err := cloneRepo(app, stageDir, sshEnv, ls); err != nil {
			phaseEnd("clone", t, err)
			failDeployFull(app.ID, deployID, ls, phases, deployStart, fmt.Sprintf("clone failed: %v", err))
			return
		}
	} else {
		logf("Fetching latest from origin")
		if err := runCmdWithEnv(stageDir, sshEnv, ls, "git", "fetch", "--depth=1", "origin", app.Branch); err != nil {
			phaseEnd("clone", t, err)
			failDeployFull(app.ID, deployID, ls, phases, deployStart, fmt.Sprintf("git fetch failed: %v", err))
			return
		}
		if err := runCmdWithEnv(stageDir, sshEnv, ls, "git", "reset", "--hard", "origin/"+app.Branch); err != nil {
			phaseEnd("clone", t, err)
			failDeployFull(app.ID, deployID, ls, phases, deployStart, fmt.Sprintf("git reset failed: %v", err))
			return
		}
	}
	phaseEnd("clone", t, nil)

	// ── Capture git commit info ────────────────────────────────────────────────
	sha := gitOutput(stageDir, sshEnv, "git", "rev-parse", "--short", "HEAD")
	msg := gitOutput(stageDir, sshEnv, "git", "log", "-1", "--pretty=%s")
	author := gitOutput(stageDir, sshEnv, "git", "log", "-1", "--pretty=%an")
	db.DB.Model(&db.Deployment{}).Where("id = ?", deployID).Updates(map[string]interface{}{
		"commit_sha":     sha,
		"commit_message": msg,
		"commit_author":  author,
	})
	logf("Commit: %s — %s (%s)", sha, msg, author)

	// ── Detect stack ───────────────────────────────────────────────────────────
	stack := DetectTechStack(stageDir)
	logf("Detected stack: %s", stack.Name)
	db.DB.Model(&db.App{}).Where("id = ?", app.ID).Updates(map[string]interface{}{"tech_stack": stack.Name, "tool": stack.Tool})

	// Override with app-level commands if set
	if app.BuildCmd != "" {
		stack.BuildCmd = app.BuildCmd
	}
	if app.StartCmd != "" {
		stack.StartCmd = app.StartCmd
	}
	// Sync back so startProcess uses the effective command
	if app.StartCmd == "" {
		app.StartCmd = stack.StartCmd
	}

	if err := ensureRuntime(stack.Runtime, ls); err != nil {
		failDeployFull(app.ID, deployID, ls, phases, deployStart, fmt.Sprintf("runtime setup failed: %v", err))
		return
	}

	envVars := buildEnvMap(app)

	// ── Phase: install ─────────────────────────────────────────────────────────
	if cancelled {
		failDeployFull(app.ID, deployID, ls, phases, deployStart, "cancelled")
		return
	}
	if stack.InstallCmd != "" {
		t = phaseStart("install")
		logf("$ %s", stack.InstallCmd)
		if err := runCmdEnv(stageDir, ls, envVars, "sh", "-c", stack.InstallCmd); err != nil {
			phaseEnd("install", t, err)
			failDeployFull(app.ID, deployID, ls, phases, deployStart, fmt.Sprintf("install failed: %v", err))
			return
		}
		phaseEnd("install", t, nil)
	} else {
		phaseSkip("install")
	}

	// ── Phase: build ───────────────────────────────────────────────────────────
	if cancelled {
		failDeployFull(app.ID, deployID, ls, phases, deployStart, "cancelled")
		return
	}
	if stack.BuildCmd != "" {
		buildCmd := replacePlaceholders(stack.BuildCmd, app)
		t = phaseStart("build")
		logf("$ %s", buildCmd)
		if err := runCmdEnv(stageDir, ls, envVars, "sh", "-c", buildCmd); err != nil {
			phaseEnd("build", t, err)
			logf("Build failed — previous deployment still active")
			failDeployFull(app.ID, deployID, ls, phases, deployStart, fmt.Sprintf("build failed: %v", err))
			return
		}
		phaseEnd("build", t, nil)
	} else {
		phaseSkip("build")
	}

	// ── Atomic swap ────────────────────────────────────────────────────────────
	if _, err := os.Stat(appDir); err == nil {
		os.RemoveAll(prevDir)
		if err := os.Rename(appDir, prevDir); err != nil {
			logf("Warning: could not archive previous build: %v", err)
		} else {
			logf("Previous build archived (rollback available)")
		}
	}
	if err := os.Rename(stageDir, appDir); err != nil {
		os.Rename(prevDir, appDir)
		failDeployFull(app.ID, deployID, ls, phases, deployStart, fmt.Sprintf("swap failed: %v", err))
		return
	}

	// ── Phase: start ───────────────────────────────────────────────────────────
	if cancelled {
		failDeployFull(app.ID, deployID, ls, phases, deployStart, "cancelled")
		return
	}
	if stack.StartCmd != "" {
		t = phaseStart("start")
		if err := startProcess(app, appDir, ls); err != nil {
			phaseEnd("start", t, err)
			logf("Warning: process start failed: %v", err)
		} else {
			phaseEnd("start", t, nil)
		}
	} else {
		phaseSkip("start")
	}

	// ── Finalise ───────────────────────────────────────────────────────────────
	dur := int64(time.Since(deployStart).Seconds())
	logf("✓ Deployed in %ds", dur)
	now := time.Now()
	phasesJSON, _ := json.Marshal(phases)
	db.DB.Model(&db.Deployment{}).Where("id = ?", deployID).Updates(map[string]interface{}{
		"status":      "success",
		"log":         ls.FullLog(),
		"finished_at": now,
		"duration":    dur,
		"phases":      string(phasesJSON),
	})
	db.DB.Model(&db.App{}).Where("id = ?", app.ID).Updates(map[string]interface{}{
		"status":           "running",
		"active_deploy_id": nil,
	})

	// Register a sslip.io preview domain in Caddy so the app is publicly reachable
	if app.PreviewSlug != "" && app.Port > 0 {
		if ip := GetPublicIP(); ip != "" {
			domain := PreviewDomain(app.PreviewSlug, ip)
			target := fmt.Sprintf("localhost:%d", app.Port)
			if err := AddDomain(domain, target, false); err != nil {
				logf("[preview] caddy registration failed: %v", err)
			} else {
				logf("[preview] http://%s", domain)
			}
		}
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func makeLogf(ls *LogStreamer) func(string, ...interface{}) {
	return func(format string, args ...interface{}) {
		msg := fmt.Sprintf("[%s] "+format+"\n", append([]interface{}{time.Now().Format("15:04:05")}, args...)...)
		ls.Write([]byte(msg))
	}
}

func cloneRepo(app *db.App, dest string, extraEnv []string, ls *LogStreamer) error {
	args := []string{"clone", "--depth=1"}
	if app.Branch != "" {
		args = append(args, "-b", app.Branch)
	}
	args = append(args, app.RepoURL, dest)
	cmd := exec.Command("git", args...)
	cmd.Env = append(os.Environ(), extraEnv...)
	return streamCmd(cmd, ls)
}

func gitOutput(dir string, extraEnv []string, name string, args ...string) string {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), extraEnv...)
	out, _ := cmd.Output()
	return strings.TrimSpace(string(out))
}

func runCmd(dir string, ls *LogStreamer, name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	return streamCmd(cmd, ls)
}

func runCmdWithEnv(dir string, extraEnv []string, ls *LogStreamer, name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), extraEnv...)
	return streamCmd(cmd, ls)
}

func runCmdEnv(dir string, ls *LogStreamer, envMap map[string]string, name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Env = os.Environ()
	for k, v := range envMap {
		cmd.Env = append(cmd.Env, k+"="+v)
	}
	return streamCmd(cmd, ls)
}

func streamCmd(cmd *exec.Cmd, ls *LogStreamer) error {
	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()
	if err := cmd.Start(); err != nil {
		return err
	}
	var wg sync.WaitGroup
	pipe := func(r io.Reader) {
		defer wg.Done()
		scanner := bufio.NewScanner(r)
		scanner.Buffer(make([]byte, 4*1024*1024), 4*1024*1024)
		for scanner.Scan() {
			ls.Write([]byte(scanner.Text() + "\n"))
		}
		_ = scanner.Err()
	}
	wg.Add(2)
	go pipe(stdout)
	go pipe(stderr)
	wg.Wait()
	return cmd.Wait()
}

func ensureRuntime(runtime string, ls *LogStreamer) error {
	switch runtime {
	case "bun":
		if _, err := exec.LookPath("bun"); err != nil {
			ls.Write([]byte("[runtime] bun not found, installing...\n"))
			return runCmd("/tmp", ls, "sh", "-c", "curl -fsSL https://bun.sh/install | bash")
		}
	case "node":
		if _, err := exec.LookPath("node"); err != nil {
			ls.Write([]byte("[runtime] node not found\n"))
		}
	case "python":
		if _, err := exec.LookPath("python3"); err != nil {
			ls.Write([]byte("[runtime] python3 not found\n"))
		}
	}
	return nil
}

func buildEnvMap(app *db.App) map[string]string {
	m := map[string]string{
		"APP_NAME": app.Name,
		"PORT":     fmt.Sprintf("%d", app.Port),
	}
	if app.EnvVarsEnc != "" {
		plain, err := Decrypt(app.EnvVarsEnc, config.C.Encryption.Key)
		if err == nil {
			for _, line := range strings.Split(plain, "\n") {
				parts := strings.SplitN(line, "=", 2)
				if len(parts) == 2 {
					m[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
				}
			}
		}
	}
	return m
}

func replacePlaceholders(s string, app *db.App) string {
	s = strings.ReplaceAll(s, "{{APP_NAME}}", app.Name)
	s = strings.ReplaceAll(s, "{{PORT}}", fmt.Sprintf("%d", app.Port))
	portMapping := ""
	if app.Port > 0 {
		portMapping = fmt.Sprintf("-p %d:%d", app.Port, app.Port)
	}
	s = strings.ReplaceAll(s, "{{PORT_MAPPING}}", portMapping)
	return s
}

func failDeployFull(appID, deployID uint, ls *LogStreamer, phases []db.DeployPhase, start time.Time, reason string) {
	ls.Write([]byte("[error] " + reason + "\n"))
	now := time.Now()
	dur := int64(now.Sub(start).Seconds())
	phasesJSON, _ := json.Marshal(phases)
	db.DB.Model(&db.Deployment{}).Where("id = ?", deployID).Updates(map[string]interface{}{
		"status":      "failed",
		"log":         ls.FullLog(),
		"finished_at": now,
		"duration":    dur,
		"phases":      string(phasesJSON),
	})
	db.DB.Model(&db.App{}).Where("id = ?", appID).Updates(map[string]interface{}{
		"status":           "failed",
		"active_deploy_id": nil,
	})
}
