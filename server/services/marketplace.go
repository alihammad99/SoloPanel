package services

import (
"encoding/json"
"fmt"
"io"
"net/http"
"strings"
"sync"
"time"
)

// Portainer templates v2 format
const portainerTemplatesURL = "https://raw.githubusercontent.com/portainer/templates/master/templates-2.0.json"

// Additional community stacks registry (compose-based)
const selfhostedComposeURL = "https://raw.githubusercontent.com/Lissy93/portainer-templates/main/templates.json"

type MarketplaceTemplate struct {
ID          string           `json:"id"`
Name        string           `json:"name"`
Description string           `json:"description"`
Category    string           `json:"category"`
Icon        string           `json:"icon"`
Tags        []string         `json:"tags"`
ComposeYAML string           `json:"compose_yaml"`
EnvVars     []TemplateEnvVar `json:"env_vars"`
Ports       []int            `json:"ports"`
Website     string           `json:"website"`
Image       string           `json:"image"`
Type        int              `json:"type"` // 1=container, 2=swarm stack, 3=compose
}

type TemplateEnvVar struct {
Key         string `json:"key"`
Description string `json:"description"`
Required    bool   `json:"required"`
Default     string `json:"default"`
}

// portainerTemplate mirrors the Portainer templates-2.0 JSON schema
type portainerTemplate struct {
Type        int    `json:"type"`
Title       string `json:"title"`
Description string `json:"description"`
Categories  []string `json:"categories"`
Platform    string `json:"platform"`
Logo        string `json:"logo"`
Image       string `json:"image"`
Repository  *struct {
URL        string `json:"url"`
Stackfile  string `json:"stackfile"`
} `json:"repository"`
Env []struct {
Name        string `json:"name"`
Label       string `json:"label"`
Description string `json:"description"`
Default     string `json:"default"`
Preset      bool   `json:"preset"`
} `json:"env"`
Ports   []string `json:"ports"`
Volumes []struct {
Container string `json:"container"`
} `json:"volumes"`
Note    string `json:"note"`
}

type portainerFeed struct {
Version   string              `json:"version"`
Templates []portainerTemplate `json:"templates"`
}

var (
templateCache     []MarketplaceTemplate
templateCacheTime time.Time
templateCacheMu   sync.RWMutex
cacheTTL          = 6 * time.Hour
)

func FetchTemplates(customURL string) ([]MarketplaceTemplate, error) {
templateCacheMu.RLock()
if time.Since(templateCacheTime) < cacheTTL && len(templateCache) > 0 {
c := make([]MarketplaceTemplate, len(templateCache))
copy(c, templateCache)
templateCacheMu.RUnlock()
return c, nil
}
templateCacheMu.RUnlock()

url := portainerTemplatesURL
if customURL != "" {
url = customURL
}

templates, err := fetchPortainerTemplates(url)
if err != nil || len(templates) == 0 {
// fallback: try community registry
templates, _ = fetchPortainerTemplates(selfhostedComposeURL)
}

if len(templates) == 0 {
return nil, fmt.Errorf("could not fetch templates from %s", url)
}

templateCacheMu.Lock()
templateCache = templates
templateCacheTime = time.Now()
templateCacheMu.Unlock()

return templates, nil
}

func fetchPortainerTemplates(url string) ([]MarketplaceTemplate, error) {
client := &http.Client{Timeout: 15 * time.Second}
resp, err := client.Get(url)
if err != nil {
return nil, err
}
defer resp.Body.Close()
body, err := io.ReadAll(resp.Body)
if err != nil {
return nil, err
}

var feed portainerFeed
if err := json.Unmarshal(body, &feed); err != nil {
return nil, err
}

results := make([]MarketplaceTemplate, 0, len(feed.Templates))
for i, t := range feed.Templates {
// Skip non-linux or windows-only
if t.Platform == "windows" {
continue
}

tpl := MarketplaceTemplate{
ID:          fmt.Sprintf("%s-%d", slugify(t.Title), i),
Name:        t.Title,
Description: t.Description,
Icon:        t.Logo,
Tags:        t.Categories,
Type:        t.Type,
Image:       t.Image,
}

// Category from first tag
if len(t.Categories) > 0 {
tpl.Category = t.Categories[0]
}

// Convert env vars (skip preset ones)
for _, e := range t.Env {
if e.Preset {
continue
}
label := e.Label
if label == "" {
label = e.Description
}
tpl.EnvVars = append(tpl.EnvVars, TemplateEnvVar{
Key:         e.Name,
Description: label,
Default:     e.Default,
Required:    e.Default == "",
})
}

// Parse ports (e.g. "8080/tcp" → 8080)
for _, p := range t.Ports {
var port int
fmt.Sscanf(strings.Split(p, "/")[0], "%d", &port)
if port > 0 {
tpl.Ports = append(tpl.Ports, port)
}
}

// For compose/stack types, build a minimal compose YAML from the repository URL
if t.Type == 2 || t.Type == 3 {
if t.Repository != nil && t.Repository.URL != "" {
tpl.ComposeYAML = fmt.Sprintf(
"# Stack from: %s\n# Stackfile: %s\n# Run: git clone %s && cd <repo> && docker compose -f %s up -d\n",
t.Repository.URL, t.Repository.Stackfile,
t.Repository.URL, t.Repository.Stackfile,
)
tpl.Website = t.Repository.URL
}
} else if t.Image != "" {
// Type 1: single container — generate a compose file
tpl.ComposeYAML = generateCompose(t)
}

results = append(results, tpl)
}

return results, nil
}

func generateCompose(t portainerTemplate) string {
var sb strings.Builder
sb.WriteString("services:\n")
svc := slugify(t.Title)
sb.WriteString(fmt.Sprintf("  %s:\n", svc))
sb.WriteString(fmt.Sprintf("    image: %s\n", t.Image))
sb.WriteString("    restart: unless-stopped\n")

if len(t.Ports) > 0 {
sb.WriteString("    ports:\n")
for _, p := range t.Ports {
parts := strings.Split(p, "/")
sb.WriteString(fmt.Sprintf("      - \"%s:%s\"\n", parts[0], parts[0]))
}
}

nonPreset := []struct{ Name, Default string }{}
for _, e := range t.Env {
if !e.Preset {
nonPreset = append(nonPreset, struct{ Name, Default string }{e.Name, e.Default})
}
}
if len(t.Env) > 0 {
sb.WriteString("    environment:\n")
for _, e := range t.Env {
if e.Default != "" && e.Preset {
sb.WriteString(fmt.Sprintf("      %s: \"%s\"\n", e.Name, e.Default))
} else {
sb.WriteString(fmt.Sprintf("      %s: ${%s}\n", e.Name, e.Name))
}
}
}

if len(t.Volumes) > 0 {
sb.WriteString("    volumes:\n")
for _, v := range t.Volumes {
volName := svc + "_" + slugify(strings.ReplaceAll(v.Container, "/", "_"))
sb.WriteString(fmt.Sprintf("      - %s:%s\n", volName, v.Container))
}
sb.WriteString("\nvolumes:\n")
for _, v := range t.Volumes {
volName := svc + "_" + slugify(strings.ReplaceAll(v.Container, "/", "_"))
sb.WriteString(fmt.Sprintf("  %s:\n", volName))
}
}

return sb.String()
}

func slugify(s string) string {
s = strings.ToLower(s)
var out strings.Builder
for _, r := range s {
if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
out.WriteRune(r)
} else {
out.WriteRune('-')
}
}
// collapse multiple dashes
result := strings.Join(strings.FieldsFunc(out.String(), func(r rune) bool { return r == '-' }), "-")
return strings.Trim(result, "-")
}

func GetTemplate(id string) (*MarketplaceTemplate, error) {
templates, err := FetchTemplates("")
if err != nil {
return nil, err
}
for _, t := range templates {
if t.ID == id {
t2 := t
return &t2, nil
}
}
return nil, fmt.Errorf("template %q not found", id)
}

// InvalidateTemplateCache forces a fresh fetch on next request (e.g. after settings change)
func InvalidateTemplateCache() {
templateCacheMu.Lock()
templateCache = nil
templateCacheTime = time.Time{}
templateCacheMu.Unlock()
}
