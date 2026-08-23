// Package record turns input lines into records.
package record

// Fields splits one record line into its fields.
//
// Fields are separated by spaces. A field wrapped in double quotes may hold
// spaces, and the quotes are not part of the field.
//
// The splitting itself is slice s_tokenize, which has not landed yet.
func Fields(line string) []string {
	return nil
}
