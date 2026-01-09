// WS-001: Basic sandbox connectivity verification
// Manual test results - PASSED
//
// Evidence:
// - Container server running on port 8085: curl http://localhost:8085/health → {"success":true,"status":"healthy"}
// - Worker dev server running on port 8788
// - GET /test/container endpoint: curl http://localhost:8788/test/container → {"status":200,"statusText":"OK","body":"Hello from terminal container!"}
// - Sandbox instance logs show container started (no timeout errors)
// - No console errors in worker logs
//
// Acceptance criteria met:
// ✅ GET /test/container returns 200 with response body
// ✅ Sandbox instance logs show container started
// ✅ No timeout errors
//
// Verification command: curl http://localhost:8788/test/container