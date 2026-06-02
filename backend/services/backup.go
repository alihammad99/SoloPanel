package services

import (
	"encoding/json"
	"fmt"
	"os/exec"

	"github.com/panel/backend/db"
)

func buildResticEnv(endpoint, bucket, accessKey, secretKey, region string) []string {
	return []string{
		"AWS_ACCESS_KEY_ID=" + accessKey,
		"AWS_SECRET_ACCESS_KEY=" + secretKey,
		"AWS_DEFAULT_REGION=" + region,
		"RESTIC_REPOSITORY=s3:" + endpoint + "/" + bucket,
	}
}

func ResticEnvFromSettings() []string {
	endpoint := db.GetSetting("s3_endpoint")
	bucket := db.GetSetting("s3_bucket")
	accessKey := db.GetSetting("s3_access_key")
	secretKey := db.GetSetting("s3_secret_key")
	region := db.GetSetting("s3_region")
	if region == "" {
		region = "us-east-1"
	}
	return buildResticEnv(endpoint, bucket, accessKey, secretKey, region)
}

func ResticPassword() string {
	return db.GetSetting("restic_password")
}

func resticEnv() []string {
	return append(buildBaseEnv(), append(ResticEnvFromSettings(),
		"RESTIC_PASSWORD="+ResticPassword(),
	)...)
}

func ResticInit(ls *LogStreamer) error {
	cmd := exec.Command("restic", "init")
	cmd.Env = resticEnv()
	return streamCmd(cmd, ls)
}

func ResticBackup(paths []string, tags []string, ls *LogStreamer) (string, error) {
	args := []string{"backup"}
	for _, t := range tags {
		args = append(args, "--tag", t)
	}
	args = append(args, paths...)

	cmd := exec.Command("restic", args...)
	cmd.Env = resticEnv()

	if err := streamCmd(cmd, ls); err != nil {
		return "", err
	}

	return getLatestSnapshotID(tags)
}

func ResticRestore(snapshotID, targetPath string, ls *LogStreamer) error {
	cmd := exec.Command("restic", "restore", snapshotID, "--target", targetPath)
	cmd.Env = resticEnv()
	return streamCmd(cmd, ls)
}

func ResticList(tags []string) ([]map[string]interface{}, error) {
	args := []string{"snapshots", "--json"}
	for _, t := range tags {
		args = append(args, "--tag", t)
	}
	cmd := exec.Command("restic", args...)
	cmd.Env = resticEnv()
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	var snapshots []map[string]interface{}
	return snapshots, json.Unmarshal(out, &snapshots)
}

func getLatestSnapshotID(tags []string) (string, error) {
	args := []string{"snapshots", "--json", "--last"}
	for _, t := range tags {
		args = append(args, "--tag", t)
	}
	cmd := exec.Command("restic", args...)
	cmd.Env = resticEnv()
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}

	var snapshots []map[string]interface{}
	if err := json.Unmarshal(out, &snapshots); err != nil || len(snapshots) == 0 {
		return "", fmt.Errorf("no snapshot found")
	}
	id, _ := snapshots[0]["short_id"].(string)
	return id, nil
}

func buildBaseEnv() []string {
	return []string{
		"HOME=/root",
		"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
	}
}
