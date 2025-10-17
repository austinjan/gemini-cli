/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  CommandContext,
  SlashCommand,
  SlashCommandActionReturn,
} from './types.js';
import { CommandKind } from './types.js';

export const initProductCommand: SlashCommand = {
  name: 'init-product',
  description:
    'Initialize a new Go + React monolithic web application with project structure and GEMINI.md documentation.',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
    _args: string,
  ): Promise<SlashCommandActionReturn> => {
    if (!context.services.config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Configuration not available.',
      };
    }
    const targetDir = context.services.config.getTargetDir();
    const geminiMdPath = path.join(targetDir, 'GEMINI.md');

    if (fs.existsSync(geminiMdPath)) {
      return {
        type: 'message',
        messageType: 'info',
        content:
          'A GEMINI.md file already exists in this directory. No changes were made.',
      };
    }

    // Create an empty GEMINI.md file
    fs.writeFileSync(geminiMdPath, '', 'utf8');

    context.ui.addItem(
      {
        type: 'info',
        text: 'Empty GEMINI.md created. Now initializing Go + React monolithic project...',
      },
      Date.now(),
    );

    return {
      type: 'submit_prompt',
      content: `
You are an AI agent that initializes a new Go + React monolithic web application.
Your task is to **create the project structure**, **write basic code samples**, and **document everything clearly** inside a \`GEMINI.md\` file.

---

#### **Analysis and Creation Process**

1. **Project Objective**

   * Build a single-executable monolithic web application using:

     * **Go backend** for the API server.
     * **React frontend** embedded via Go's \`embed.FS\`.
   * The backend serves the React app directly as static files.

2. **Project Initialization**

   * Create the following directory structure:

     \`\`\`
     ProjectRoot/
     ├── backend/
     │   ├── cmd/                       # Main applications
     │   ├── pkg/                       # Public libraries
     │   ├── internal/                  # Private application code
     │
     ├── frontend/
     │   ├── src/                       # React web UI source
     │
     ├── Makefile                       # Build automation
     └── README.md                      # Project overview
     \`\`\`

3. **Generate Files**

   * Scaffold a minimal backend HTTP server using Go's \`embed\` to serve \`dist\` assets.
   * Include a placeholder \`setupRoutes()\` function and simple \`main.go\` entrypoint.
   * Create a minimal React \`App.jsx\` file under \`frontend/src/\`.
   * Generate a \`Makefile\` with rules:

     * \`make build\` → builds both frontend and backend
     * \`make run\` → runs the app locally
     * \`make clean\` → removes build artifacts

4. **Documentation (\`GEMINI.md\`)**
   Write the following sections:

   * **Overview:** Explain monolithic design and embedded web UI concept.
   * **Directory Structure:** Explain each folder's purpose.
   * **Backend Server Code:** Include the provided Go example with explanations:

\`\`\`go
//go:embed all:dist
var staticFS embed.FS

type staticFileSystem struct {
	http.FileSystem
}

// newStaticFileSystem initializes a new staticFileSystem instance
// that serves files from the embedded "dist" directory.
func newStaticFileSystem() *staticFileSystem {
	sub, err := fs.Sub(staticFS, "dist")
	if err != nil {
		panic(err)
	}

	return &staticFileSystem{
		FileSystem: http.FS(sub),
	}
}


func RunnerMain(listenPort int) {

	r := setupRunnerRouters()
	err := http.ListenAndServe(fmt.Sprintf(":%d", listenPort), r)
	if err != nil {
	// deal with error, print error, log error, etc.

	}
}

// Main
// This is the main function of the server. It starts the server and listens for incoming requests.
func Main(listenPort int) {

	zap.L().Info("Starting server", zap.Int("port", listenPort))

	r := setupRoutes() // Assuming this returns *chi.Mux or http.Handler

	// Setup static file serving
	staticManager := newStaticFileSystem()
	fileServer := http.FileServer(staticManager.FileSystem)

	// Add the static file handler to the router \`r\`
	// This handles serving static assets and provides SPA fallback to index.html
	if chiMux, ok := r.(*chi.Mux); ok {
		chiMux.Get("/*", func(w http.ResponseWriter, req *http.Request) {
			requestedPath := req.URL.Path // Use URL.Path, not RequestURI

			// Check if the requested path corresponds to an actual static file.
			// The \`exists\` method now only takes the path relative to "dist".
			if !staticManager.exists(requestedPath) {
				// File does not exist, attempt to serve index.html (SPA fallback)
				indexPath := "index.html" // Relative to the "dist" embed root
				indexContent, err := staticFS.ReadFile("dist/" + indexPath)
				if err != nil {
					zap.L().Error("Failed to read index.html for SPA fallback", zap.Error(err), zap.String("path", requestedPath))
					http.NotFound(w, req)
					return
				}
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.Write(indexContent)
				return
			}

			// File exists, serve it.
			// Determine the prefix to strip based on how the handler is mounted.
			// For a "/*" pattern, RoutePattern() is "/*", so pathPrefix becomes "".
			rctx := chi.RouteContext(req.Context())
			pathPrefix := strings.TrimSuffix(rctx.RoutePattern(), "/*")
			http.StripPrefix(pathPrefix, fileServer).ServeHTTP(w, req)
		})
	} else {
		zap.L().Warn("Router is not a *chi.Mux, skipping static file handler setup via Get method.")
		// Optionally, provide a more generic way to add the handler if r is just http.Handler
		// For example, by wrapping r or using a middleware approach if applicable.
	}

	// Start the HTTP server in a goroutine so Main can wait if needed (e.g., for other tasks)
	var wg sync.WaitGroup
	wg.Add(1) // Add 1 for the ListenAndServe goroutine

	go func() {
		defer wg.Done()
		zap.L().Info("HTTP server listening", zap.Int("port", listenPort))
		err := http.ListenAndServe(fmt.Sprintf(":%d", listenPort), r)
		if err != nil {
			// http.ErrServerClosed is a normal error on graceful shutdown, don't log as fatal.
			if err != http.ErrServerClosed {
				// Check if it's a port binding error
				if isPortInUseError(err) {
					zap.L().Fatal(fmt.Sprintf("Port %d is already in use. Please stop the existing process or use a different port.", listenPort), zap.Error(err))
				} else {
					zap.L().Fatal("HTTP server ListenAndServe error", zap.Error(err))
				}
			} else {
				zap.L().Info("HTTP server closed gracefully.")
			}
		}
	}()

	wg.Wait() // Wait for the ListenAndServe goroutine to finish (e.g., on error or shutdown)
	zap.L().Info("Server shutdown complete.")
}
\`\`\`

Frontend vite sample: Make sure the output is embedded correctly.
\`\`\`jsx
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, '../backend/internal/server/dist'),
    emptyOutDir: true,
  }
});
\`\`\`

   * **Frontend:** Describe React build and how assets are embedded.
   * **Build and Run:** Document commands from the \`Makefile\`.
   * **Next Steps:** Suggest how to extend routes, API endpoints, and frontend features.

5. **Output**

   * Create all necessary folders and stub files.
   * Write \`GEMINI.md\` with complete Markdown documentation.
   * Ensure formatting and code blocks are correct for direct use in a repository.
   * Create basic code files with minimal viable content to get started.
   * Create a script that can build both frontend and backend, in windows the build script should be a .bat file. 
`,
    };
  },
};
