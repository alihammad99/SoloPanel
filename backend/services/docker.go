package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os/exec"
	"strings"
)

var dockerHTTP = &http.Client{
	Transport: &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", "/var/run/docker.sock")
		},
	},
}

func dockerGet(path string, v interface{}) error {
	resp, err := dockerHTTP.Get("http://localhost/v1.43" + path)
	if err != nil {
		return fmt.Errorf("docker socket: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		data, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("docker API %d: %s", resp.StatusCode, string(data))
	}
	return json.NewDecoder(resp.Body).Decode(v)
}

func dockerPost(path string) error {
	resp, err := dockerHTTP.Post("http://localhost/v1.43"+path, "application/json", nil)
	if err != nil {
		return fmt.Errorf("docker socket: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		data, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("docker API %d: %s", resp.StatusCode, string(data))
	}
	return nil
}

func dockerDelete(path string) error {
	req, _ := http.NewRequest("DELETE", "http://localhost/v1.43"+path, nil)
	resp, err := dockerHTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		data, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("docker API %d: %s", resp.StatusCode, string(data))
	}
	return nil
}

func InitDocker() error {
	var info map[string]interface{}
	if err := dockerGet("/info", &info); err != nil {
		return fmt.Errorf("cannot reach docker socket: %w", err)
	}
	return nil
}

type Container struct {
	ID      string   `json:"ID"`
	Names   []string `json:"Names"`
	Image   string   `json:"Image"`
	State   string   `json:"State"`
	Status  string   `json:"Status"`
	Ports   []Port   `json:"Ports"`
}

type Port struct {
	IP          string `json:"IP"`
	PrivatePort int    `json:"PrivatePort"`
	PublicPort  int    `json:"PublicPort"`
	Type        string `json:"Type"`
}

type ImageInfo struct {
	ID       string   `json:"ID"`
	RepoTags []string `json:"RepoTags"`
	Size     int64    `json:"Size"`
	Created  string   `json:"Created"`
}

type VolumeInfo struct {
	Name       string `json:"Name"`
	Driver     string `json:"Driver"`
	Mountpoint string `json:"Mountpoint"`
}

type NetworkInfo struct {
	ID     string `json:"ID"`
	Name   string `json:"Name"`
	Driver string `json:"Driver"`
	Scope  string `json:"Scope"`
}

type ContainerStats struct {
	CPUPercent float64
	MemUsage   uint64
	MemLimit   uint64
}

// apiContainer matches the Docker Engine API response shape
type apiContainer struct {
	ID    string   `json:"Id"`
	Names []string `json:"Names"`
	Image string   `json:"Image"`
	State string   `json:"State"`
	Status string  `json:"Status"`
	Ports []struct {
		IP          string `json:"IP"`
		PrivatePort int    `json:"PrivatePort"`
		PublicPort  int    `json:"PublicPort"`
		Type        string `json:"Type"`
	} `json:"Ports"`
}

func ListContainers(_ context.Context) ([]Container, error) {
	var raw []apiContainer
	if err := dockerGet("/containers/json?all=true", &raw); err != nil {
		return nil, err
	}
	out := make([]Container, len(raw))
	for i, c := range raw {
		ports := make([]Port, len(c.Ports))
		for j, p := range c.Ports {
			ports[j] = Port{IP: p.IP, PrivatePort: p.PrivatePort, PublicPort: p.PublicPort, Type: p.Type}
		}
		out[i] = Container{ID: c.ID, Names: c.Names, Image: c.Image, State: c.State, Status: c.Status, Ports: ports}
	}
	return out, nil
}

func StartContainer(_ context.Context, id string) error {
	return dockerPost("/containers/" + id + "/start")
}

func StopContainer(_ context.Context, id string) error {
	return dockerPost("/containers/" + id + "/stop?t=10")
}

func RemoveContainer(_ context.Context, id string, force bool) error {
	q := ""
	if force {
		q = "?force=true"
	}
	return dockerDelete("/containers/" + id + q)
}

func ContainerLogs(_ context.Context, id string, tail string) (string, error) {
	resp, err := dockerHTTP.Get(fmt.Sprintf(
		"http://localhost/v1.43/containers/%s/logs?stdout=true&stderr=true&tail=%s", id, tail))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	// Strip Docker multiplexed stream headers (8-byte prefix per frame)
	return stripDockerLogs(data), nil
}

func stripDockerLogs(data []byte) string {
	var sb strings.Builder
	for len(data) >= 8 {
		size := int(data[4])<<24 | int(data[5])<<16 | int(data[6])<<8 | int(data[7])
		if size <= 0 || 8+size > len(data) {
			sb.Write(data)
			return sb.String()
		}
		sb.Write(data[8 : 8+size])
		data = data[8+size:]
	}
	return sb.String()
}

type apiImage struct {
	ID       string   `json:"Id"`
	RepoTags []string `json:"RepoTags"`
	Size     int64    `json:"Size"`
	Created  int64    `json:"Created"`
}

func ListImages(_ context.Context) ([]ImageInfo, error) {
	var raw []apiImage
	if err := dockerGet("/images/json", &raw); err != nil {
		return nil, err
	}
	out := make([]ImageInfo, len(raw))
	for i, img := range raw {
		out[i] = ImageInfo{ID: img.ID, RepoTags: img.RepoTags, Size: img.Size}
	}
	return out, nil
}

func PullImage(_ context.Context, imageName string, logWriter io.Writer) error {
	cmd := exec.Command("docker", "pull", imageName)
	cmd.Stdout = logWriter
	cmd.Stderr = logWriter
	return cmd.Run()
}

func RemoveImage(_ context.Context, id string, force bool) error {
	q := ""
	if force {
		q = "?force=true"
	}
	return dockerDelete("/images/" + id + q)
}

type apiVolume struct {
	Name       string `json:"Name"`
	Driver     string `json:"Driver"`
	Mountpoint string `json:"Mountpoint"`
}

func ListVolumes(_ context.Context) ([]VolumeInfo, error) {
	var resp struct {
		Volumes []apiVolume `json:"Volumes"`
	}
	if err := dockerGet("/volumes", &resp); err != nil {
		return nil, err
	}
	out := make([]VolumeInfo, len(resp.Volumes))
	for i, v := range resp.Volumes {
		out[i] = VolumeInfo{Name: v.Name, Driver: v.Driver, Mountpoint: v.Mountpoint}
	}
	return out, nil
}

type apiNetwork struct {
	ID     string `json:"Id"`
	Name   string `json:"Name"`
	Driver string `json:"Driver"`
	Scope  string `json:"Scope"`
}

func ListNetworks(_ context.Context) ([]NetworkInfo, error) {
	var raw []apiNetwork
	if err := dockerGet("/networks", &raw); err != nil {
		return nil, err
	}
	out := make([]NetworkInfo, len(raw))
	for i, n := range raw {
		out[i] = NetworkInfo{ID: n.ID, Name: n.Name, Driver: n.Driver, Scope: n.Scope}
	}
	return out, nil
}

func DockerVersion(_ context.Context) (string, error) {
	var v struct {
		Version string `json:"Version"`
	}
	if err := dockerGet("/version", &v); err != nil {
		return "", err
	}
	return v.Version, nil
}

func ComposeUp(appDir string, ls *LogStreamer, envMap map[string]string) error {
	return runCmdEnv(appDir, ls, envMap, "docker", "compose", "up", "-d", "--build")
}

func ComposeDown(appDir string, ls *LogStreamer) error {
	return runCmd(appDir, ls, "docker", "compose", "down")
}

func ComposeLogs(appDir string, tail string) (string, error) {
	out, err := exec.Command("docker", "compose", "logs", "--tail="+tail).Output()
	return string(out), err
}
