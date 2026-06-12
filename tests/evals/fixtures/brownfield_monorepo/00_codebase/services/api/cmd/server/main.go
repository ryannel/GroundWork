package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	r := chi.NewRouter()
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	r.Route("/boards", func(r chi.Router) {
		r.Get("/", listBoards(pool))
		r.Post("/", createBoard(pool))
	})
	r.Route("/tasks", func(r chi.Router) {
		r.Get("/", listTasks(pool))
		r.Post("/", createTask(pool))
		r.Patch("/{id}/status", updateTaskStatus(pool))
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}
	log.Printf("api listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func listBoards(pool *pgxpool.Pool) http.HandlerFunc      { return notImplemented }
func createBoard(pool *pgxpool.Pool) http.HandlerFunc     { return notImplemented }
func listTasks(pool *pgxpool.Pool) http.HandlerFunc       { return notImplemented }
func createTask(pool *pgxpool.Pool) http.HandlerFunc      { return notImplemented }
func updateTaskStatus(pool *pgxpool.Pool) http.HandlerFunc { return notImplemented }

func notImplemented(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusNotImplemented)
}
