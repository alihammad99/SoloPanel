package db

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	GithubID  int64  `gorm:"uniqueIndex"`
	Username  string `gorm:"uniqueIndex"`
	Email     string
	AvatarURL string
	Allowed   bool `gorm:"default:false"`
}

type App struct {
	gorm.Model
	Name           string `gorm:"uniqueIndex"`
	RepoURL        string
	Branch         string `gorm:"default:main"`
	DeployKeyPub   string
	DeployKeyPriv  string
	TechStack      string
	Tool           string
	Status         string `gorm:"default:idle"`
	EnvVarsEnc     string
	Domain         string
	Port           int
	ProcessType    string `gorm:"default:docker"`
	DockerImage    string
	BuildCmd       string
	StartCmd       string
	UserID         uint
	User           User
	Pid            int    // PID of running process (0 = not running)
	ActiveDeployID *uint  // non-nil while a deploy is in progress
	PreviewSlug    string `gorm:"uniqueIndex"`
	PreviewURL     string `gorm:"-" json:"preview_url,omitempty"`
}

type Deployment struct {
	gorm.Model
	AppID         uint
	App           App
	CommitSHA     string
	CommitMessage string
	CommitAuthor  string
	Branch        string
	Status        string
	Phases        string `gorm:"type:text"` // JSON array of DeployPhase
	Log           string `gorm:"type:text"`
	StartedAt     time.Time
	FinishedAt    *time.Time
	Duration      int64 // seconds
}

// DeployPhase is stored as JSON inside Deployment.Phases
type DeployPhase struct {
	Name      string `json:"name"`
	Status    string `json:"status"`               // pending | running | success | failed | skipped
	StartedAt int64  `json:"started_at,omitempty"` // unix ms
	Duration  int64  `json:"duration_ms,omitempty"`
}

type DockerStack struct {
	gorm.Model
	Name        string `gorm:"uniqueIndex"`
	TemplateID  string
	ComposeYAML string `gorm:"type:text"`
	Status      string `gorm:"default:stopped"`
	EnvVarsEnc  string
	UserID      uint
}

type Domain struct {
	gorm.Model
	AppID       *uint
	StackID     *uint
	Domain      string `gorm:"uniqueIndex"`
	SSLStatus   string `gorm:"default:pending"`
	CaddyConfig string `gorm:"type:text"`
	TargetPort  int
}

type Backup struct {
	gorm.Model
	AppID         *uint
	StackID       *uint
	SnapshotID    string
	Size          int64
	Tags          string
	Status        string
	ScheduledCron string
}

type Setting struct {
	gorm.Model
	Key   string `gorm:"uniqueIndex"`
	Value string `gorm:"type:text"`
}

type SSHKey struct {
	gorm.Model
	AppID      uint
	PublicKey  string `gorm:"type:text"`
	PrivateKey string `gorm:"type:text"`
	RepoURL    string
}

type Bucket struct {
	gorm.Model
	Name        string `gorm:"uniqueIndex"`
	Public      bool   `gorm:"default:false"`
	UserID      uint
	SizeBytes   int64
	UploadToken string `gorm:"index"`
	ReadToken   string `gorm:"index"`
}

type StorageObject struct {
	gorm.Model
	BucketID    uint
	Key         string `gorm:"index"`
	OrigName    string
	ContentType string
	Size        int64
	ShareToken  string `gorm:"uniqueIndex"`
	Public      bool   `gorm:"default:false"`
}
