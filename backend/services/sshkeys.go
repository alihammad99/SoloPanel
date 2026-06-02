package services

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/pem"
	"fmt"

	"golang.org/x/crypto/ssh"
)

type SSHKeyPair struct {
	PublicKey  string
	PrivateKey string
}

func GenerateSSHKeyPair(comment string) (*SSHKeyPair, error) {
	pubKey, privKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate key: %w", err)
	}

	sshPub, err := ssh.NewPublicKey(pubKey)
	if err != nil {
		return nil, fmt.Errorf("new public key: %w", err)
	}
	pubBytes := ssh.MarshalAuthorizedKey(sshPub)
	if comment != "" {
		pubBytes = append(pubBytes[:len(pubBytes)-1], []byte(" "+comment+"\n")...)
	}

	privPEM, err := ssh.MarshalPrivateKey(privKey, "")
	if err != nil {
		return nil, fmt.Errorf("marshal private key: %w", err)
	}
	privBytes := pem.EncodeToMemory(privPEM)

	return &SSHKeyPair{
		PublicKey:  string(pubBytes),
		PrivateKey: string(privBytes),
	}, nil
}
