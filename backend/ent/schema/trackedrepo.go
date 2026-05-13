package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

// TrackedRepo holds a GitHub repository that the user is watching.
type TrackedRepo struct {
	ent.Schema
}

func (TrackedRepo) Fields() []ent.Field {
	return []ent.Field{
		field.String("owner").
			NotEmpty().
			MaxLen(100),
		field.String("name").
			NotEmpty().
			MaxLen(100),
		// full_name is owner/name; we keep it denormalized so uniqueness and
		// lookups are a single column.
		field.String("full_name").
			NotEmpty().
			MaxLen(201).
			Unique(),
		field.String("description").
			Optional().
			MaxLen(1024).
			Default(""),
		field.Int("stars").
			NonNegative().
			Default(0),
		field.String("language").
			Optional().
			Default(""),
		field.String("html_url").
			NotEmpty(),
		field.String("notes").
			Optional().
			MaxLen(2000).
			Default(""),
		field.Time("fetched_at").
			Default(time.Now),
		field.Time("created_at").
			Default(time.Now).
			Immutable(),
		field.Time("updated_at").
			Default(time.Now).
			UpdateDefault(time.Now),
	}
}

func (TrackedRepo) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("language"),
		index.Fields("stars"),
	}
}