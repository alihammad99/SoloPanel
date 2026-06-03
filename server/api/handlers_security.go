package api

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/panel/backend/config"
)

// ── Malware signatures ────────────────────────────────────────────────────────

// malwareSig with optional file-extension allowlist (nil = all extensions)
type malwareSig struct {
	Name           string
	Severity       string
	Pattern        *regexp.Regexp
	OnlyExts       []string       // if set, only match files with these extensions
	ExcludeComment *regexp.Regexp // skip line if it looks like a comment mentioning this
}

var malwareSigs = []malwareSig{
	// PHP-only: eval(base64_decode( — very specific, low FP
	{Name: "PHP webshell (eval+base64)", Severity: "critical",
		OnlyExts: []string{".php", ".php3", ".php4", ".php5", ".phtml"},
		Pattern:  regexp.MustCompile(`(?i)eval\s*\(\s*base64_decode\s*\(`)},

	// $_GET['x']($_POST['y']) — classic PHP shell dispatch
	{Name: "PHP webshell (user-input dispatch)", Severity: "critical",
		OnlyExts: []string{".php", ".php3", ".php4", ".php5", ".phtml"},
		Pattern:  regexp.MustCompile(`(?i)\$_(GET|POST|REQUEST|COOKIE)\s*\[.{0,40}\]\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)`)},

	// PHP shell execution — only in PHP files to avoid FP in docs/tests
	{Name: "PHP shell execution", Severity: "critical",
		OnlyExts: []string{".php", ".php3", ".php4", ".php5", ".phtml"},
		Pattern:  regexp.MustCompile(`(?i)(?:^|[^a-zA-Z_])(passthru|shell_exec|proc_open)\s*\(`)},

	// /dev/tcp reverse shell — very specific, valid in shell scripts and strings
	{Name: "Bash /dev/tcp reverse shell", Severity: "critical",
		Pattern: regexp.MustCompile(`/dev/tcp/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{2,5}`)},

	// nc -e /bin/sh — netcat reverse shell
	{Name: "Netcat reverse shell", Severity: "critical",
		Pattern: regexp.MustCompile(`(?i)\bnc\b.{0,30}-e\s+/bin/(ba)?sh`)},

	// Stratum mining protocol — very specific, no FP
	{Name: "Crypto miner (stratum protocol)", Severity: "critical",
		Pattern: regexp.MustCompile(`stratum\+tcp://|stratum\+ssl://`)},

	// Known miner pool domains
	{Name: "Crypto miner (pool domain)", Severity: "critical",
		Pattern: regexp.MustCompile(`(?i)(pool\.minexmr\.com|xmrpool\.eu|moneroocean\.stream|c3pool\.com|hashvault\.pro)`)},

	// xmrig/minerd binary references in scripts
	{Name: "Crypto miner binary", Severity: "high",
		OnlyExts: []string{".sh", ".bash", ".py", ".pl", ".rb"},
		Pattern:  regexp.MustCompile(`(?i)\b(xmrig|cpuminer|minerd|cgminer|bfgminer)\b`)},

	// document.write(unescape( — classic JS obfuscation
	{Name: "Obfuscated JS (document.write+unescape)", Severity: "high",
		OnlyExts: []string{".js", ".html", ".htm"},
		Pattern:  regexp.MustCompile(`document\.write\s*\(\s*unescape\s*\(`)},

	// Perl reverse shell: use Socket + exec("/bin/sh")
	{Name: "Perl reverse shell", Severity: "critical",
		OnlyExts: []string{".pl"},
		Pattern:  regexp.MustCompile(`(?i)exec\s*\(\s*["/]bin/(ba)?sh`)},

	// wget/curl | sh/bash — dropper pattern
	{Name: "wget/curl dropper (pipe to shell)", Severity: "high",
		Pattern: regexp.MustCompile(`(?i)(wget|curl)\s+[^|\n]{0,80}\|\s*(?:ba)?sh`)},

	// echo >> ~/.ssh/authorized_keys
	{Name: "SSH authorized_keys injection", Severity: "high",
		Pattern: regexp.MustCompile(`>>\s*[~"]?/?(?:\$HOME/|/root/|/home/[^/]+/)\.ssh/authorized_keys`)},

	// export LD_PRELOAD= (in scripts, not config files)
	{Name: "LD_PRELOAD hijack", Severity: "high",
		OnlyExts: []string{".sh", ".bash", ".py", ".pl", ".rb"},
		Pattern:  regexp.MustCompile(`(?i)export\s+LD_PRELOAD\s*=`)},
}

// Extensions to scan (focused — skip config/log/text to cut noise)
var scanExtensions = map[string]bool{
	".php": true, ".php3": true, ".php4": true, ".php5": true, ".phtml": true,
	".py": true, ".rb": true, ".pl": true, ".sh": true, ".bash": true,
	".js": true, ".html": true, ".htm": true,
	".jsp": true, ".asp": true, ".aspx": true,
}

// Directories to skip entirely
var skipDirNames = map[string]bool{
	"node_modules": true, "vendor": true, ".git": true, ".svn": true,
	"dist": true, "build": true, ".next": true, ".nuxt": true,
	"__pycache__": true, ".venv": true, "venv": true, "env": true,
	".cache": true, "coverage": true, ".quarantine": true,
}

const maxFileSizeScan = 5 * 1024 * 1024 // 5 MB

// ── Types ─────────────────────────────────────────────────────────────────────

type ScanFinding struct {
	Path     string `json:"path"`
	Line     int    `json:"line"`
	Match    string `json:"match"`
	Rule     string `json:"rule"`
	Severity string `json:"severity"`
}

type SecurityCheck struct {
	Name   string `json:"name"`
	Status string `json:"status"` // ok / warning / critical
	Detail string `json:"detail"`
}

type ScanResult struct {
	StartedAt    time.Time       `json:"started_at"`
	FinishedAt   time.Time       `json:"finished_at"`
	Findings     []ScanFinding   `json:"findings"`
	Checks       []SecurityCheck `json:"checks"`
	ScannedFiles int             `json:"scanned_files"`
	Error        string          `json:"error,omitempty"`
}

// ── In-memory scan state ──────────────────────────────────────────────────────

var (
	scanMu      sync.Mutex
	lastScan    *ScanResult
	scanRunning bool
)

// ── Handlers ─────────────────────────────────────────────────────────────────

func handleGetSecurityStatus(w http.ResponseWriter, r *http.Request) {
	scanMu.Lock()
	defer scanMu.Unlock()
	writeJSON(w, map[string]interface{}{
		"running":   scanRunning,
		"last_scan": lastScan,
	})
}

func handleRunScan(w http.ResponseWriter, r *http.Request) {
	scanMu.Lock()
	if scanRunning {
		scanMu.Unlock()
		writeError(w, "scan already running", http.StatusConflict)
		return
	}
	scanRunning = true
	scanMu.Unlock()

	go func() {
		result := runFullScan()
		scanMu.Lock()
		lastScan = result
		scanRunning = false
		scanMu.Unlock()
	}()

	writeJSON(w, map[string]string{"status": "started"})
}

func handleGetScanResult(w http.ResponseWriter, r *http.Request) {
	scanMu.Lock()
	defer scanMu.Unlock()
	if lastScan == nil {
		writeJSON(w, map[string]interface{}{"findings": nil, "checks": nil, "running": scanRunning})
		return
	}
	writeJSON(w, map[string]interface{}{
		"running":       scanRunning,
		"started_at":    lastScan.StartedAt,
		"finished_at":   lastScan.FinishedAt,
		"findings":      lastScan.Findings,
		"checks":        lastScan.Checks,
		"scanned_files": lastScan.ScannedFiles,
		"error":         lastScan.Error,
	})
}

func handleQuarantineFile(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Path == "" {
		writeError(w, "invalid input", http.StatusBadRequest)
		return
	}

	// Security: only allow quarantining files strictly under apps dir or storage dir
	appsDir := config.C.Storage.AppsDir
	storageDir := filepath.Join(filepath.Dir(config.C.DB.Path), ".storage")
	abs, err := filepath.Abs(input.Path)
	if err != nil {
		writeError(w, "path not allowed", http.StatusForbidden)
		return
	}
	inApps := func() bool {
		rel, e := filepath.Rel(appsDir, abs)
		return e == nil && !strings.HasPrefix(rel, "..")
	}()
	inStorage := func() bool {
		rel, e := filepath.Rel(storageDir, abs)
		return e == nil && !strings.HasPrefix(rel, "..")
	}()
	if !inApps && !inStorage {
		writeError(w, "path not allowed", http.StatusForbidden)
		return
	}

	quarantineDir := filepath.Join(filepath.Dir(config.C.DB.Path), ".quarantine")
	os.MkdirAll(quarantineDir, 0700)

	dest := filepath.Join(quarantineDir, fmt.Sprintf("%d_%s", time.Now().Unix(), filepath.Base(abs)))
	if err := os.Rename(abs, dest); err != nil {
		writeError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"quarantined_to": dest})
}

// ── Scanner ───────────────────────────────────────────────────────────────────

func runFullScan() *ScanResult {
	result := &ScanResult{
		StartedAt: time.Now(),
		Findings:  []ScanFinding{},
		Checks:    []SecurityCheck{},
	}

	// 1. Malware scan over apps dir
	appsDir := config.C.Storage.AppsDir
	scanned, findings := scanDir(appsDir)
	result.ScannedFiles = scanned
	result.Findings = append(result.Findings, findings...)

	// Also scan S3 storage dir
	storageDir := filepath.Join(filepath.Dir(config.C.DB.Path), ".storage")
	scanned2, findings2 := scanDir(storageDir)
	result.ScannedFiles += scanned2
	result.Findings = append(result.Findings, findings2...)

	// 2. Security system checks
	result.Checks = append(result.Checks, checkSSHConfig()...)
	result.Checks = append(result.Checks, checkOpenPorts()...)
	result.Checks = append(result.Checks, checkFailedLogins())
	result.Checks = append(result.Checks, checkWorldWritable())
	result.Checks = append(result.Checks, checkSUIDFiles())
	result.Checks = append(result.Checks, checkRootProcesses())
	result.Checks = append(result.Checks, checkFirewall())
	result.Checks = append(result.Checks, checkCronJobs())

	result.FinishedAt = time.Now()
	return result
}

func scanDir(root string) (int, []ScanFinding) {
	var findings []ScanFinding
	scanned := 0

	if _, err := os.Stat(root); err != nil {
		return 0, nil
	}

	filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		// Skip blacklisted directory names
		if info.IsDir() {
			name := info.Name()
			if skipDirNames[name] || (strings.HasPrefix(name, ".") && len(name) > 1) {
				return filepath.SkipDir
			}
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if !scanExtensions[ext] {
			return nil
		}
		if info.Size() > maxFileSizeScan {
			return nil
		}

		scanned++
		f, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer f.Close()

		buf := bufio.NewScanner(f)
		buf.Buffer(make([]byte, 64*1024), 64*1024)
		lineNum := 0
		for buf.Scan() {
			lineNum++
			line := buf.Text()
			trimmed := strings.TrimSpace(line)
			// Skip pure comment lines
			if strings.HasPrefix(trimmed, "//") || strings.HasPrefix(trimmed, "#") ||
				strings.HasPrefix(trimmed, "*") || strings.HasPrefix(trimmed, "<!--") {
				continue
			}
			for _, sig := range malwareSigs {
				// Check file extension filter
				if len(sig.OnlyExts) > 0 {
					match := false
					for _, e := range sig.OnlyExts {
						if e == ext {
							match = true
							break
						}
					}
					if !match {
						continue
					}
				}
				if sig.Pattern.MatchString(line) {
					match := line
					if len(match) > 200 {
						match = match[:200] + "…"
					}
					findings = append(findings, ScanFinding{
						Path:     path,
						Line:     lineNum,
						Match:    strings.TrimSpace(match),
						Rule:     sig.Name,
						Severity: sig.Severity,
					})
					break // one finding per line
				}
			}
		}
		if err := buf.Err(); err != nil {
			return err
		}
		return nil
	})
	return scanned, findings
}

// ── System checks ─────────────────────────────────────────────────────────────

func runCmd(name string, args ...string) string {
	out, err := exec.Command(name, args...).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func checkSSHConfig() []SecurityCheck {
	var checks []SecurityCheck
	data, err := os.ReadFile("/etc/ssh/sshd_config")
	if err != nil {
		checks = append(checks, SecurityCheck{Name: "SSH config", Status: "ok", Detail: "Cannot read sshd_config (needs root) — run panel as root to check"})
		return checks
	}
	content := string(data)

	rootLogin := "PermitRootLogin"
	if regexp.MustCompile(`(?i)PermitRootLogin\s+yes`).MatchString(content) {
		checks = append(checks, SecurityCheck{Name: rootLogin, Status: "critical", Detail: "Root SSH login is permitted — disable it in sshd_config"})
	} else {
		checks = append(checks, SecurityCheck{Name: rootLogin, Status: "ok", Detail: "Root login is disabled or key-only"})
	}

	passAuth := "SSH Password Authentication"
	if regexp.MustCompile(`(?i)PasswordAuthentication\s+yes`).MatchString(content) {
		checks = append(checks, SecurityCheck{Name: passAuth, Status: "warning", Detail: "Password authentication enabled — prefer key-based auth only"})
	} else {
		checks = append(checks, SecurityCheck{Name: passAuth, Status: "ok", Detail: "Password authentication is disabled"})
	}

	return checks
}

func checkOpenPorts() []SecurityCheck {
	out := runCmd("ss", "-tlnp")
	if out == "" {
		out = runCmd("netstat", "-tlnp")
	}
	if out == "" {
		return []SecurityCheck{{Name: "Open Ports", Status: "warning", Detail: "Could not list open ports (ss/netstat unavailable)"}}
	}

	suspiciousPorts := []string{"4444", "5555", "6666", "7777", "8888", "9999", "1337", "31337"}
	var found []string
	for _, port := range suspiciousPorts {
		if strings.Contains(out, ":"+port) {
			found = append(found, port)
		}
	}

	if len(found) > 0 {
		return []SecurityCheck{{Name: "Suspicious Open Ports", Status: "critical", Detail: fmt.Sprintf("Suspicious ports open: %s", strings.Join(found, ", "))}}
	}
	return []SecurityCheck{{Name: "Open Ports", Status: "ok", Detail: "No commonly suspicious ports detected"}}
}

func checkFailedLogins() SecurityCheck {
	// try journalctl first, fallback to auth.log
	var out string
	cmd := exec.Command("journalctl", "-u", "ssh", "--since", "24 hours ago", "--no-pager", "-q")
	var buf bytes.Buffer
	cmd.Stdout = &buf
	if err := cmd.Run(); err == nil {
		out = buf.String()
	} else {
		data, err := os.ReadFile("/var/log/auth.log")
		if err == nil {
			out = string(data)
		}
	}

	if out == "" {
		return SecurityCheck{Name: "Failed SSH Logins", Status: "ok", Detail: "Cannot read SSH logs (needs root) — run panel as root to check"}
	}

	count := strings.Count(out, "Failed password") + strings.Count(out, "Invalid user")
	if count > 100 {
		return SecurityCheck{Name: "Failed SSH Logins", Status: "critical", Detail: fmt.Sprintf("%d failed attempts in last 24h — possible brute-force attack", count)}
	} else if count > 20 {
		return SecurityCheck{Name: "Failed SSH Logins", Status: "warning", Detail: fmt.Sprintf("%d failed login attempts in last 24h", count)}
	}
	return SecurityCheck{Name: "Failed SSH Logins", Status: "ok", Detail: fmt.Sprintf("%d failed attempts in last 24h", count)}
}

func checkWorldWritable() SecurityCheck {
	out := runCmd("find", "/var/www", "/srv", "/home", "-type", "f", "-perm", "-o+w", "-not", "-path", "*/.git/*", "2>/dev/null")
	if out == "" {
		// Try apps dir
		out = runCmd("find", config.C.Storage.AppsDir, "-type", "f", "-perm", "-o+w")
	}
	lines := nonEmpty(strings.Split(out, "\n"))
	if len(lines) > 0 {
		detail := fmt.Sprintf("%d world-writable files found", len(lines))
		if len(lines) <= 3 {
			detail += ": " + strings.Join(lines, ", ")
		}
		return SecurityCheck{Name: "World-Writable Files", Status: "warning", Detail: detail}
	}
	return SecurityCheck{Name: "World-Writable Files", Status: "ok", Detail: "No world-writable files found"}
}

func checkSUIDFiles() SecurityCheck {
	out := runCmd("find", "/usr/local", "/opt", "/srv", "/home", "-type", "f", "-perm", "-4000")
	lines := nonEmpty(strings.Split(out, "\n"))
	// Filter known legitimate SUID binaries
	var suspicious []string
	legitimateSUID := map[string]bool{
		"/usr/bin/sudo": true, "/usr/bin/su": true, "/usr/bin/passwd": true,
		"/usr/bin/newgrp": true, "/usr/bin/chsh": true, "/usr/bin/chfn": true,
		"/usr/bin/gpasswd": true, "/usr/bin/pkexec": true, "/bin/ping": true,
		"/usr/bin/ping": true, "/usr/bin/mount": true, "/usr/bin/umount": true,
	}
	for _, f := range lines {
		if !legitimateSUID[f] {
			suspicious = append(suspicious, f)
		}
	}
	if len(suspicious) > 0 {
		return SecurityCheck{Name: "Unexpected SUID Binaries", Status: "warning", Detail: fmt.Sprintf("Found %d unexpected SUID binaries: %s", len(suspicious), strings.Join(suspicious, ", "))}
	}
	return SecurityCheck{Name: "SUID Binaries", Status: "ok", Detail: "No unexpected SUID binaries found"}
}

func checkRootProcesses() SecurityCheck {
	out := runCmd("ps", "aux")
	var suspicious []string
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 11 {
			continue
		}
		user := fields[0]
		cmd := strings.Join(fields[10:], " ")
		if user == "root" {
			for _, kw := range []string{"nc ", "ncat ", "netcat ", "python -c", "perl -e", "ruby -e", "/dev/tcp"} {
				if strings.Contains(cmd, kw) {
					suspicious = append(suspicious, cmd)
					break
				}
			}
		}
	}
	if len(suspicious) > 0 {
		return SecurityCheck{Name: "Suspicious Root Processes", Status: "critical", Detail: fmt.Sprintf("Suspicious processes running as root: %s", strings.Join(suspicious, " | "))}
	}
	return SecurityCheck{Name: "Root Processes", Status: "ok", Detail: "No suspicious root processes detected"}
}

func checkFirewall() SecurityCheck {
	// Check ufw or iptables
	ufw := runCmd("ufw", "status")
	if strings.Contains(ufw, "Status: active") {
		return SecurityCheck{Name: "Firewall (ufw)", Status: "ok", Detail: "ufw is active"}
	}
	iptables := runCmd("iptables", "-L", "-n")
	if iptables != "" && !strings.Contains(iptables, "Chain INPUT (policy ACCEPT)\nChain FORWARD (policy ACCEPT)\nChain OUTPUT (policy ACCEPT)") {
		return SecurityCheck{Name: "Firewall (iptables)", Status: "ok", Detail: "iptables rules are configured"}
	}
	nft := runCmd("nft", "list", "ruleset")
	if nft != "" {
		return SecurityCheck{Name: "Firewall (nftables)", Status: "ok", Detail: "nftables rules are configured"}
	}
	return SecurityCheck{Name: "Firewall", Status: "warning", Detail: "No active firewall detected (ufw/iptables/nftables). Consider enabling one."}
}

// Known legitimate cron script names — skip these to avoid false positives
var legitimateCronScripts = map[string]bool{
	"apt-compat": true, "apt": true, "dpkg": true, "google-chrome": true,
	"chrome": true, "firefox": true, "man-db": true, "mlocate": true,
	"updatedb": true, "logrotate": true, "sysstat": true, "unattended-upgrades": true,
	"apport": true, "bsdmainutils": true, "cracklib-runtime": true,
}

func checkCronJobs() SecurityCheck {
	var suspicious []string
	// Check system-wide crontabs — only look for high-confidence dropper patterns
	dropper := regexp.MustCompile(`(?i)(wget|curl)\s+[^|\n]{0,80}\|\s*(?:ba)?sh|/dev/tcp/\d|nc\s+-e\s+/bin`)
	dirs := []string{"/etc/cron.d", "/etc/cron.daily", "/etc/cron.hourly", "/var/spool/cron/crontabs"}
	for _, dir := range dirs {
		filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return nil
			}
			// Skip known-legitimate scripts
			if legitimateCronScripts[filepath.Base(path)] {
				return nil
			}
			data, err := os.ReadFile(path)
			if err != nil {
				return nil
			}
			if dropper.Match(data) {
				suspicious = append(suspicious, filepath.Base(path))
			}
			return nil
		})
	}

	// Also scan /tmp and /var/tmp for suspicious scripts
	for _, tmpDir := range []string{"/tmp", "/var/tmp"} {
		entries, _ := os.ReadDir(tmpDir)
		for _, e := range entries {
			if !e.IsDir() {
				info, _ := e.Info()
				if info != nil && info.Mode()&0111 != 0 { // executable
					suspicious = append(suspicious, fmt.Sprintf("%s/%s (executable in tmp)", tmpDir, e.Name()))
				}
			}
		}
	}

	if len(suspicious) > 0 {
		return SecurityCheck{Name: "Cron Jobs & Tmp Executables", Status: "warning", Detail: strings.Join(suspicious, "; ")}
	}
	return SecurityCheck{Name: "Cron Jobs", Status: "ok", Detail: "No suspicious cron entries or tmp executables found"}
}

// ── helpers ───────────────────────────────────────────────────────────────────

func nonEmpty(lines []string) []string {
	var out []string
	for _, l := range lines {
		if strings.TrimSpace(l) != "" {
			out = append(out, l)
		}
	}
	return out
}
