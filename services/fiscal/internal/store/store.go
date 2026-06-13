// Package store persists fiscal invoices. The default implementation is an
// in-memory store suitable for development and tests; production deployments
// swap in a durable backend implementing the same Store interface.
package store

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/catalinalabs/salesfactory/services/fiscal/internal/domain"
)

// ErrNotFound is returned when an invoice id is unknown.
var ErrNotFound = errors.New("invoice not found")

// Store is the persistence contract for emitted fiscal invoices.
type Store interface {
	// Save stores an invoice under its id (assigned by the caller).
	Save(inv domain.Invoice) error
	// Get returns a stored invoice by id.
	Get(id string) (domain.Invoice, error)
	// NextNumber returns the next consecutive fiscal number for a series,
	// formatted as a zero-padded 9-digit string, atomically.
	NextNumber(series string) (string, error)
	// List returns all stored invoices (newest-insertion order not guaranteed).
	List() []domain.Invoice
}

// Memory is a concurrency-safe in-memory Store.
type Memory struct {
	mu        sync.Mutex
	invoices  map[string]domain.Invoice
	order     []string
	sequences map[string]int
}

func NewMemory() *Memory {
	return &Memory{invoices: map[string]domain.Invoice{}, sequences: map[string]int{}}
}

func (m *Memory) Save(inv domain.Invoice) error {
	if inv.ID == "" {
		return errors.New("store: invoice id required")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.invoices[inv.ID]; !exists {
		m.order = append(m.order, inv.ID)
	}
	m.invoices[inv.ID] = inv
	return nil
}

func (m *Memory) Get(id string) (domain.Invoice, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invoices[id]
	if !ok {
		return domain.Invoice{}, ErrNotFound
	}
	return inv, nil
}

func (m *Memory) NextNumber(series string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sequences[series]++
	return fmt.Sprintf("%09d", m.sequences[series]), nil
}

func (m *Memory) List() []domain.Invoice {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]domain.Invoice, 0, len(m.order))
	for _, id := range m.order {
		out = append(out, m.invoices[id])
	}
	return out
}

// NewID generates a sortable, time-prefixed invoice id. It is not a ULID but is
// monotonic enough for development and unique within a process.
func NewID() string {
	return fmt.Sprintf("inv_%d", time.Now().UnixNano())
}
