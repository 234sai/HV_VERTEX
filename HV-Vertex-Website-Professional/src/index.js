Latest build failed

Edit code
Visit
↗
Back to builds
Build #00a70a8b
12s

main
Manually deployed
29s ago


Build settings

234sai/HV_VERTEX
Build command
None
Deploy command
npx wrangler deploy
Root directory
HV-Vertex-Website-Professional
Build token
hv-vertex build token

Build variables
None

Initializing


2s

15:15:54.111

Cloning


1s

15:15:56.495

Installing


4s

15:15:57.702

Deploying


4s

15:16:01.933

15:15:54.111
Initializing build environment...
15:15:56.112
Success: Finished initializing build environment
15:15:56.714
Cloning repository...
15:15:57.930
No build output detected to cache. Skipping.
15:15:57.930
No dependencies detected to cache. Skipping.
15:15:57.939
Detected the following tools from environment: bun@1.2.15, nodejs@24.18.0
15:15:57.941
Installing project dependencies: bun install
15:15:58.456
bun install v1.2.15 (df017990)
15:15:58.467
Resolving dependencies
15:16:01.531
Resolved, downloaded and extracted [262]
15:16:01.904
Saved lockfile
15:16:01.905
15:16:01.905
+ wrangler@4.144.0
15:16:01.905
15:16:01.905
37 packages installed [3.48s]
15:16:02.173
Executing user deploy command: npx wrangler deploy
15:16:03.859
15:16:03.859
 ⛅️ wrangler 4.144.0
15:16:03.859
────────────────────
15:16:03.945
15:16:03.946
Cloudflare collects anonymous telemetry about your usage of Wrangler. Learn more at https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler/telemetry.md
15:16:03.948
15:16:04.024
✘ [ERROR] Build failed with 1 error:
15:16:04.024
15:16:04.024
  ✘ [ERROR] Syntax error "v"
15:16:04.024
  
15:16:04.024
      src/index.js:200:103:
15:16:04.024
        200 │ ...mail:${email}\nPhone: ${phone \vert{}\vert{} 'Not provided'}\n...
15:16:04.024
            ╵                                   ^
15:16:04.024
  
15:16:04.024
  
15:16:04.024
15:16:04.024
15:16:04.096
🪵  Logs were written to "/opt/buildhome/.config/.wrangler/logs/wrangler-2026-09-30_09-46-03_472.log"
15:16:04.205
Failed: error occurred while running deploy command
