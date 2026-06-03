package db

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func RandomToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func randomToken() string { return RandomToken() }

var DB *gorm.DB

func Init(dsn string) error {
	if err := os.MkdirAll(filepath.Dir(dsn), 0750); err != nil {
		return err
	}

	var err error
	DB, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return err
	}

	if err := DB.AutoMigrate(
		&User{},
		&App{},
		&Deployment{},
		&DockerStack{},
		&Domain{},
		&Backup{},
		&Setting{},
		&SSHKey{},
		&Bucket{},
		&StorageObject{},
	); err != nil {
		return err
	}

	// Backfill tokens for existing buckets that were created before tokens were added
	var buckets []Bucket
	DB.Find(&buckets)
	for _, b := range buckets {
		updates := map[string]interface{}{}
		if b.UploadToken == "" {
			updates["upload_token"] = randomToken()
		}
		if b.ReadToken == "" {
			updates["read_token"] = randomToken()
		}
		if len(updates) > 0 {
			DB.Model(&Bucket{}).Where("id = ?", b.ID).Updates(updates)
		}
	}

	log.Println("[db] SQLite initialized at", dsn)
	return nil
}

func GetSetting(key string) string {
	var s Setting
	if err := DB.Where("key = ?", key).First(&s).Error; err != nil {
		return ""
	}
	return s.Value
}

func SetSetting(key, value string) error {
	var s Setting
	result := DB.Where("key = ?", key).First(&s)
	if result.Error != nil {
		return DB.Create(&Setting{Key: key, Value: value}).Error
	}
	return DB.Model(&s).Update("value", value).Error
}
