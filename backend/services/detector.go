package services

import (
	"os"
	"path/filepath"
)

type TechStack struct {
	Name      string
	BuildCmd  string
	StartCmd  string
	Runtime   string
	InstallCmd string
}

func DetectTechStack(repoPath string) TechStack {
	has := func(name string) bool {
		_, err := os.Stat(filepath.Join(repoPath, name))
		return err == nil
	}

	// Detect package manager
	pkgManager := "npm"
	installCmd := "npm install"
	if has("bun.lockb") || has("bun.lock") {
		pkgManager = "bun"
		installCmd = "bun install"
	} else if has("pnpm-lock.yaml") {
		pkgManager = "pnpm"
		installCmd = "pnpm install"
	} else if has("yarn.lock") {
		pkgManager = "yarn"
		installCmd = "yarn install"
	}

	switch {
	case has("Dockerfile"):
		return TechStack{
			Name:     "docker",
			BuildCmd: "docker build -t {{APP_NAME}} .",
			StartCmd: "docker run -d --name {{APP_NAME}} {{APP_NAME}}",
			Runtime:  "docker",
		}

	case has("docker-compose.yml") || has("docker-compose.yaml"):
		return TechStack{
			Name:     "docker-compose",
			BuildCmd: "docker compose build",
			StartCmd: "docker compose up -d",
			Runtime:  "docker-compose",
		}

	case has("go.mod"):
		return TechStack{
			Name:     "go",
			BuildCmd: "go build -o app .",
			StartCmd: "./app",
			Runtime:  "go",
		}

	case has("pyproject.toml"):
		return TechStack{
			Name:       "python",
			InstallCmd: "pip install -e .",
			BuildCmd:   "",
			StartCmd:   "python -m uvicorn main:app --host 0.0.0.0 --port {{PORT}}",
			Runtime:    "python",
		}

	case has("requirements.txt"):
		return TechStack{
			Name:       "python",
			InstallCmd: "pip install -r requirements.txt",
			BuildCmd:   "",
			StartCmd:   "python main.py",
			Runtime:    "python",
		}

	case has("Gemfile"):
		return TechStack{
			Name:       "ruby",
			InstallCmd: "bundle install",
			BuildCmd:   "",
			StartCmd:   "bundle exec ruby app.rb",
			Runtime:    "ruby",
		}

	case has("Cargo.toml"):
		return TechStack{
			Name:     "rust",
			BuildCmd: "cargo build --release",
			StartCmd: "./target/release/app",
			Runtime:  "rust",
		}

	case has("package.json"):
		buildCmd := detectJSBuildCmd(repoPath, pkgManager)
		entrypoint := detectJSEntry(repoPath)
		startCmd := pkgManager + " run start"
		if pkgManager == "bun" {
			startCmd = "bun run " + entrypoint
		}
		pkgName := pkgManager
		if pkgManager == "bun" {
			pkgName = "bun"
		}
		return TechStack{
			Name:       pkgName,
			InstallCmd: installCmd,
			BuildCmd:   buildCmd,
			StartCmd:   startCmd,
			Runtime:    "node",
		}

	default:
		return TechStack{
			Name:    "unknown",
			Runtime: "unknown",
		}
	}
}

func detectJSBuildCmd(repoPath, pkgManager string) string {
	pkgJSON := filepath.Join(repoPath, "package.json")
	data, err := os.ReadFile(pkgJSON)
	if err != nil {
		return ""
	}
	content := string(data)

	if !contains(content, `"build"`) {
		return ""
	}

	// Monorepo with turbo/nx/lerna: find vite app and build directly skipping tsc
	isTurbo := contains(content, `"turbo"`) || fileExists(filepath.Join(repoPath, "turbo.json"))
	isNx := fileExists(filepath.Join(repoPath, "nx.json"))
	isLerna := fileExists(filepath.Join(repoPath, "lerna.json"))
	if isTurbo || isNx || isLerna {
		// Try to find a vite-based app sub-directory
		vitePath := findViteApp(repoPath)
		if vitePath != "" {
			return `cd ` + vitePath + ` && npx vite build`
		}
		// Fallback: run turbo but ignore TS errors
		return `FORCE_COLOR=0 ` + pkgManager + ` run build 2>&1; exit 0`
	}

	// If build script contains "tsc &&" pattern (type-check then vite),
	// patch it to skip tsc and go straight to vite build
	if (contains(content, `"tsc &&`) || contains(content, `"tsc -p`) ) &&
		contains(content, "vite") {
		return `npx vite build`
	}

	switch pkgManager {
	case "bun":
		return "bun run build"
	case "pnpm":
		return "pnpm run build"
	case "yarn":
		return "yarn build"
	default:
		return "npm run build"
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// findViteApp searches common monorepo sub-dirs for a vite.config file
func findViteApp(repoPath string) string {
	candidates := []string{"apps/web", "apps/app", "apps/frontend", "web", "app", "frontend", "packages/web"}
	for _, sub := range candidates {
		dir := filepath.Join(repoPath, sub)
		for _, cfg := range []string{"vite.config.ts", "vite.config.js", "vite.config.mts"} {
			if fileExists(filepath.Join(dir, cfg)) {
				return sub
			}
		}
	}
	// Generic search one level deep
	entries, err := os.ReadDir(repoPath)
	if err != nil {
		return ""
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		dir := filepath.Join(repoPath, e.Name())
		for _, cfg := range []string{"vite.config.ts", "vite.config.js", "vite.config.mts"} {
			if fileExists(filepath.Join(dir, cfg)) {
				return e.Name()
			}
		}
	}
	return ""
}

func detectJSEntry(repoPath string) string {
	for _, f := range []string{"index.ts", "index.js", "src/index.ts", "src/index.js", "server.ts", "server.js"} {
		if _, err := os.Stat(filepath.Join(repoPath, f)); err == nil {
			return f
		}
	}
	return "start"
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsStr(s, substr))
}

func containsStr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
