package record

import "errors"

// A Record is one parsed input line.
type Record struct {
	Kind string // what sort of line it is, such as "info" or "warn"
	Host string // the machine the line came from
	Msg  string // the rest of the line, as one string
}

// ErrShortLine reports a line with fewer than three fields.
var ErrShortLine = errors.New("record: line has fewer than three fields")

// Parse turns one line into a Record.
//
// The first field is the kind, the second is the host, and the rest join
// with single spaces to make the message.
//
// Building the record is slice s_record_parse, which has not landed yet.
func Parse(line string) (Record, error) {
	return Record{}, nil
}
