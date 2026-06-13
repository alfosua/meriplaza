// Package store persists catalog sellers, products and orders in memory.
package store

import (
	"errors"
	"sync"

	"github.com/catalinalabs/salesfactory/services/catalog/internal/domain"
)

var ErrNotFound = errors.New("not found")

type Memory struct {
	mu       sync.Mutex
	sellers  map[string]domain.Seller
	handles  map[string]string // handle -> seller id
	products map[string]domain.Product
	orders   map[string]domain.Order
}

func NewMemory() *Memory {
	return &Memory{
		sellers:  map[string]domain.Seller{},
		handles:  map[string]string{},
		products: map[string]domain.Product{},
		orders:   map[string]domain.Order{},
	}
}

func (m *Memory) SaveSeller(s domain.Seller) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if id, ok := m.handles[s.Handle]; ok && id != s.ID {
		return errors.New("handle already taken")
	}
	m.sellers[s.ID] = s
	m.handles[s.Handle] = s.ID
	return nil
}

func (m *Memory) Seller(id string) (domain.Seller, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.sellers[id]
	if !ok {
		return domain.Seller{}, ErrNotFound
	}
	return s, nil
}

func (m *Memory) SellerByHandle(h string) (domain.Seller, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	id, ok := m.handles[h]
	if !ok {
		return domain.Seller{}, ErrNotFound
	}
	return m.sellers[id], nil
}

func (m *Memory) SaveProduct(p domain.Product) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.products[p.ID] = p
	return nil
}

func (m *Memory) Product(id string) (domain.Product, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	p, ok := m.products[id]
	if !ok {
		return domain.Product{}, ErrNotFound
	}
	return p, nil
}

// ProductsBySeller returns active and inactive products for a seller.
func (m *Memory) ProductsBySeller(sellerID string) []domain.Product {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []domain.Product
	for _, p := range m.products {
		if p.SellerID == sellerID {
			out = append(out, p)
		}
	}
	return out
}

func (m *Memory) SaveOrder(o domain.Order) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.orders[o.ID] = o
	return nil
}

func (m *Memory) Order(id string) (domain.Order, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	o, ok := m.orders[id]
	if !ok {
		return domain.Order{}, ErrNotFound
	}
	return o, nil
}

// DecrementStock reduces stock for an order's lines atomically.
func (m *Memory) DecrementStock(lines []domain.OrderLine) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	// Validate first, then apply, so partial decrements never happen.
	for _, l := range lines {
		p, ok := m.products[l.ProductID]
		if !ok {
			return ErrNotFound
		}
		if p.Stock < l.Quantity {
			return errors.New("insufficient stock")
		}
	}
	for _, l := range lines {
		p := m.products[l.ProductID]
		p.Stock -= l.Quantity
		m.products[l.ProductID] = p
	}
	return nil
}
