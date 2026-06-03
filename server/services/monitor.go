package services

import (
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

type SystemMetrics struct {
	Timestamp   int64   `json:"ts"`
	CPUPercent  float64 `json:"cpu"`
	MemTotal    uint64  `json:"mem_total"`
	MemUsed     uint64  `json:"mem_used"`
	MemPercent  float64 `json:"mem_pct"`
	DiskTotal   uint64  `json:"disk_total"`
	DiskUsed    uint64  `json:"disk_used"`
	DiskPercent float64 `json:"disk_pct"`
	NetBytesSent uint64 `json:"net_sent"`
	NetBytesRecv uint64 `json:"net_recv"`
	Goroutines  int     `json:"goroutines"`
}

func CollectMetrics() (*SystemMetrics, error) {
	m := &SystemMetrics{
		Timestamp:  time.Now().UnixMilli(),
		Goroutines: runtime.NumGoroutine(),
	}

	cpuPcts, err := cpu.Percent(200*time.Millisecond, false)
	if err == nil && len(cpuPcts) > 0 {
		m.CPUPercent = cpuPcts[0]
	}

	memInfo, err := mem.VirtualMemory()
	if err == nil {
		m.MemTotal = memInfo.Total
		m.MemUsed = memInfo.Used
		m.MemPercent = memInfo.UsedPercent
	}

	diskInfo, err := disk.Usage("/")
	if err == nil {
		m.DiskTotal = diskInfo.Total
		m.DiskUsed = diskInfo.Used
		m.DiskPercent = diskInfo.UsedPercent
	}

	netStats, err := net.IOCounters(false)
	if err == nil && len(netStats) > 0 {
		m.NetBytesSent = netStats[0].BytesSent
		m.NetBytesRecv = netStats[0].BytesRecv
	}

	return m, nil
}
