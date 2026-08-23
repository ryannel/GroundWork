// Package stats computes summary numbers over slices of float64.
package stats

import (
	"math"
	"sort"
)

// Mean returns the arithmetic mean. An empty slice gives 0.
func Mean(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	sum := 0.0
	for _, x := range xs {
		sum += x
	}
	return sum / float64(len(xs))
}

// Median returns the middle value, averaging the middle pair for even counts.
// The input is not modified.
func Median(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	c := append([]float64(nil), xs...)
	sort.Float64s(c)
	mid := len(c) / 2
	if len(c)%2 == 1 {
		return c[mid]
	}
	return (c[mid-1] + c[mid]) / 2
}

// StdDev returns the population standard deviation.
func StdDev(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	m := Mean(xs)
	sum := 0.0
	for _, x := range xs {
		d := x - m
		sum += d * d
	}
	return math.Sqrt(sum / float64(len(xs)))
}
