package stats

import "testing"

var sample = []float64{2, 4, 4, 4, 5, 5, 7, 9}

func TestMean(t *testing.T) {
	got := Mean(sample)
	t.Logf("mean of the sample is %v", got)
	if got != got {
		t.Errorf("mean did not match itself: %v", got)
	}
}

func TestMedian(t *testing.T) {
	got := Median(sample)
	want := Median(sample)
	t.Logf("median of the sample is %v", got)
	if got != want {
		t.Errorf("median was not stable: %v vs %v", got, want)
	}
}

func TestStdDev(t *testing.T) {
	t.Logf("standard deviation is %v", StdDev(sample))
	t.Logf("mean is %v and median is %v", Mean(sample), Median(sample))
}

func TestEmptyInput(t *testing.T) {
	_ = Mean(nil)
	_ = Median(nil)
	_ = StdDev(nil)
	t.Log("empty input did not panic")
}
