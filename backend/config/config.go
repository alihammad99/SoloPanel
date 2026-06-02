package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server struct {
		Port    int    `yaml:"port"`
		Host    string `yaml:"host"`
		BaseURL string `yaml:"base_url"`
	} `yaml:"server"`
	Auth struct {
		GithubClientID     string   `yaml:"github_client_id"`
		GithubClientSecret string   `yaml:"github_client_secret"`
		JWTSecret          string   `yaml:"jwt_secret"`
		AllowedUsers       []string `yaml:"allowed_users"`
	} `yaml:"auth"`
	DB struct {
		Path string `yaml:"path"`
	} `yaml:"db"`
	Storage struct {
		AppsDir    string `yaml:"apps_dir"`
		BackupsDir string `yaml:"backups_dir"`
		KeysDir    string `yaml:"keys_dir"`
	} `yaml:"storage"`
	S3 struct {
		Endpoint  string `yaml:"endpoint"`
		Bucket    string `yaml:"bucket"`
		AccessKey string `yaml:"access_key"`
		SecretKey string `yaml:"secret_key"`
		Region    string `yaml:"region"`
	} `yaml:"s3"`
	Caddy struct {
		AdminAPI string `yaml:"admin_api"`
	} `yaml:"caddy"`
	Encryption struct {
		Key string `yaml:"key"`
	} `yaml:"encryption"`
}

var C Config

func Load(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return yaml.Unmarshal(data, &C)
}

func Default() Config {
	c := Config{}
	c.Server.Port = 8080
	c.Server.Host = "127.0.0.1"
	c.DB.Path = "/var/panel/panel.db"
	c.Storage.AppsDir = "/var/panel/apps"
	c.Storage.BackupsDir = "/var/panel/backups"
	c.Storage.KeysDir = "/var/panel/keys"
	c.Caddy.AdminAPI = "http://localhost:2019"
	return c
}
