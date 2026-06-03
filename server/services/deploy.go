package services

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/panel/backend/config"
	"github.com/panel/backend/db"
)

type LogStreamer struct {
	mu       sync.Mutex
	lines    []string
	subs     []chan string
	done     bool
}

func NewLogStreamer() *LogStreamer {
	return &LogStreamer{}
}

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
	ch := make(chan string, 100)
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

var activeStreamers sync.Map

func GetStreamer(deployID uint) *LogStreamer {
	if v, ok := activeStreamers.Load(deployID); ok {
		return v.(*LogStreamer)
	}
	return nil
}

func RunDeploy(app *db.App, deployID uint, commitSHA, githubToken string) {
	ls := NewLogStreamer()
	activeStreamers.Store(deployID, ls)
	defer func() {
		ls.Done()
		activeStreamers.Delete(deployID)
	}()

	logf := func(format string, args ...interface{}) {
		msg := fmt.Sprintf("[%s] "+format+"\n", append([]interface{}{time.Now().Format("15:04:05")}, args...)...)
		ls.Write([]byte(msg))
	}

	now := time.Now()
	db.DB.Model(&db.Deployment{}).Where("id = ?", deployID).Updates(map[string]interface{}{
		"status":     "running",
		"started_at": now,
	})

	appDir := filepath.Join(config.C.Storage.AppsDir, app.Name)
	stageDir := appDir + ".staging"
	prevDir := appDir + ".prev"

	logf("Starting deployment for %s", app.Name)

	// Write deploy key to a temp file; used for both clone and pull
	var sshEnv []string
	if app.DeployKeyPriv != "" {
		os.MkdirAll(config.C.Storage.KeysDir, 0700)
		keyPath := filepath.Join(config.C.Storage.KeysDir, fmt.Sprintf("app_%d", app.ID))
		if err := os.WriteFile(keyPath, []byte(app.DeployKeyPriv), 0600); err != nil {
			failDeploy(deployID, ls, fmt.Sprintf("write deploy key: %v", err))
			return
		}
		sshEnv = []string{fmt.Sprintf(
			"GIT_SSH_COMMAND=ssh -i %s -o StrictHostKeyChecking=no -o IdentitiesOnly=yes",
			keyPath,
		)}
	}

	// Clone or pull into staging directory
	gitDir := filepath.Join(stageDir, ".git")
	if _, err := os.Stat(stageDir); err == nil {
		if _, err2 := os.Stat(gitDir); os.IsNotExist(err2) {
			os.RemoveAll(stageDir)
		}
	}

	if _, err := os.Stat(stageDir); os.IsNotExist(err) {
		logf("Cloning repository %s", app.RepoURL)
		if err := cloneRepo(app, stageDir, sshEnv, ls); err != nil {
			failDeploy(deployID, ls, fmt.Sprintf("clone failed: %v", err))
			return
		}
	} else {
		logf("Pulling latest changes")
		if err := runCmdWithEnv(stageDir, sshEnv, ls, "git", "pull", "--ff-only"); err != nil {
			failDeploy(deployID, ls, fmt.Sprintf("git pull failed: %v", err))
			return
		}
	}

	logf("Detecting tech stack")
	stack := DetectTechStack(stageDir)
	logf("Detected: %s", stack.Name)

	db.DB.Model(&db.App{}).Where("id = ?", app.ID).Update("tech_stack", stack.Name)

	if err := ensureRuntime(stack.Runtime, ls); err != nil {
		failDeploy(deployID, ls, fmt.Sprintf("runtime setup failed: %v", err))
		return
	}

	envVars := buildEnvMap(app)

	if stack.InstallCmd != "" {
		logf("Installing dependencies: %s", stack.InstallCmd)
		if err := runCmdEnv(stageDir, ls, envVars, "sh", "-c", stack.InstallCmd); err != nil {
			failDeploy(deployID, ls, fmt.Sprintf("install failed: %v", err))
			return
		}
	}

	if stack.BuildCmd != "" {
		buildCmd := replacePlaceholders(stack.BuildCmd, app)
		logf("Building: %s", buildCmd)
		if err := runCmdEnv(stageDir, ls, envVars, "sh", "-c", buildCmd); err != nil {
			// Build failed — keep previous live build untouched
			logf("Build failed, previous deployment still active")
			failDeploy(deployID, ls, fmt.Sprintf("build failed: %v", err))
			return
		}
	}

	// Build succeeded — atomic swap: live → prev, staging → live
	if _, err := os.Stat(appDir); err == nil {
		os.RemoveAll(prevDir)
		if err := os.Rename(appDir, prevDir); err != nil {
			logf("Warning: could not archive previous build: %v", err)
		} else {
			logf("Previous build archived for rollback")
		}
	}
	if err := os.Rename(stageDir, appDir); err != nil {
		// Swap failed — restore previous
		os.Rename(prevDir, appDir)
		failDeploy(deployID, ls, fmt.Sprintf("swap failed: %v", err))
		return
	}

	logf("Deployment complete")
	now2 := time.Now()
	db.DB.Model(&db.Deployment{}).Where("id = ?", deployID).Updates(map[string]interface{}{
		"status":      "success",
		"log":         ls.FullLog(),
		"finished_at": now2,
	})
	db.DB.Model(&db.App{}).Where("id = ?", app.ID).Update("status", "running")
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
	return s
}

func failDeploy(deployID uint, ls *LogStreamer, reason string) {
	ls.Write([]byte("[error] " + reason + "\n"))
	now := time.Now()
	log := ls.FullLog()
	result := db.DB.Model(&db.Deployment{}).Where("id = ?", deployID).Updates(map[string]interface{}{
		"status":      "failed",
		"log":         log,
		"finished_at": now,
	})
	if result.Error != nil {
		fmt.Printf("[failDeploy] db error: %v\n", result.Error)
	}
}
