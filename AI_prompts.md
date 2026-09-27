# Homework 4 — AI Prompt Log

This log records the prompts used while completing Homework 4, which continues the Campus Customs work using a SQLite database of the catalogue, inventory, and users.

## Problem 1 — Vibe coder prompts

### My prompt(s)

> I'm now on homework 4 for AI foundations. Put everything I do in there like my previous homework assignments. Unzip data-3 so I have the following:
>
> - data/campus_customs.d -- SQLite database with the tables catalogue, inventory, and users
> - data/products/ -- product images; paths should match the catalogue table.

> I'm now on problem 1 titled "Vibe coder prompts"
>
> Create AI_prompts.md and similar to previous assignments add a section for each problem that includes the following:
> - the problem number and title of the problem
> - the first prompt I typed in my own words (transcribe what I write word for word)
> - one follow-up prompt if it was needed and one sentence of what was lacking after the first (if no second prompt was needed, say that)

### Follow-up / what was lacking after the first prompt

No follow-up was needed. `data-3` was already extracted in Downloads, so it was copied into `data/`: `data/campus_customs.db` (tables `catalogue` with 102 products, `inventory` with 612 rows, `users` with 3 rows, plus a `chat_messages` table) and `data/products/` (102 images). All 102 `image_file_path` values in `catalogue` point to an existing image. `AI_prompts.md` was created in the same format as Homeworks 1–3.

## Problem 2 — Analyze the database

### My prompt(s)

> I'm now on Problem 2: Analyze the database
>
> Do a quick analysis of data/campus_customs.db to understand the fields of each table in order to understand things like catalogue, inventory, and users. Then start output/harness.md, transcribe each table and its fields and add a brief, one line sentence on why each field matters for Campus Customs or the chatbot.

### Follow-up / what was lacking after the first prompt

No follow-up was needed. `output/harness.md` was started with each table (`catalogue`, `inventory`, `users`, and the extra `chat_messages` table) listing its fields, types, row counts, and a one-line note on why each field matters.

## Problem 3 — Build the Campus Customs website

### My prompt(s)

> Now on to Problem 3: Build the Campus Customs website
>
> I want you to scaffold a React Vite Typescript frontend for Campus Customs. Include a nav bar at the top that links to the following pages:
> - Home
> - Products
> - About Us
> - Log In
> - Create Account
>
> It should pull Campus Customs-type wording from yalebulldogblue.com for the Home and About Us sections, but I want them written in my voice, not just a copy-paste from the reference site. Then, on the Products page, include various images from the catalogue by using the image paths from the database and include basic product info like the product name, price, and a brief description.
>
> I want each product to open a single-item page with a large image on one side, full product text on the other (e.g., price, description, sizes/stock).
>
> When a user clicks on a card on the Products page, it should take the shopper there. Then I want to add a chat interface in the bottom right of the site (like a floating chat panel). It can be a stub for now that will call to the backend later in a future problem. I'll need a small API coming up to read the database, but let's start with a simple FastAPI app in backend/main.py to serve product and images for now.

### Follow-up / what was lacking after the first prompt

No follow-up was needed. The site was built in `frontend/` (React, Vite, and TypeScript) with a FastAPI backend in `backend/main.py` that serves `/api/products`, `/api/products/{id}`, and `/media/products/*`. The backend was moved to port 8001 because another local app was already using port 8000.

## Problem 4 — Create account and login

### My prompt(s)

> I'm now on Problem 4: Create account and login
>
> I want to build a simple create-account / login flow with the following:
> - Create account: first name, last name, email, password (include a confirm password functionality and require that new account passwords include a special character and a number and give the users a "Password Strength" rating so they know if it's strong or not
> - Log in: email and password
>
> When someone creates a new account it should go into the users table - be sure to store passwords securely so no hackers are able to access them.
>
> The seed database has a test user that can be used while building (ignore my password requirements for this one):
> - Email: test@campuscustoms.yale.edu
> - Password: password
>
> Confirm that account combination can log in as that user and then I'll want to try confirming that a brand-new account creation also works. Then update output/harness.md with how the auth works (include what's stored for a user and how passwords are being protected).

### Follow-up / what was lacking after the first prompt

No follow-up was needed. Register, login, logout, and "me" endpoints were added, using PBKDF2-SHA256 hashing (600k iterations, per-user salt) and a signed HttpOnly session cookie. The Create Account page has a live checklist, a Password Strength meter, and a confirm-password check. The test user was confirmed to log in, and new-account creation was verified against a copy of the database.

## Problem 5 — PydanticAI agent backend

### My prompt(s)

> Now I'm on Problem 5: PydanticAI agent backend
>
> I now want to build the shop chatbot as a PydanticAI agent behind FastAPI that plugs into the frontend chat widget. Place the API app in backend/main.py which is the file to run with Uvicorn. I want to keep the agent as the four files next to it like in hw3:
> - backend/prompts/prompt/md -- system prompt
> - backend/agent.py -- wiring / agent entry
> - backend/tools.py -- tools the agent can call
> - backend/models.py -- PydanticAI structured types
>
> In main.py I want to expose a chat route so a message on the website can return a reply from the agent and anything else needed for products/auth. Then put Campus Customs' voice and safety basics into prompts/prompt/md. I want to start or update types in models.py for chat replies and product cards as needed. Finally, in output/harness.md, document how the frontend talks to FastAPI and how my agent is loaded such as the prompt file and model. Confirm that the backend runs from the backend/ folder as follows: uvicorn main:app --reload --port 8000

### Follow-up / what was lacking after the first prompt

No follow-up was needed. The chatbot was built as a PydanticAI agent across `backend/prompts/prompt.md`, `agent.py`, `tools.py`, and `models.py`. `main.py` gained `POST /api/chat` and `GET /api/chat/history`, and the chat widget now shows agent replies with product cards from the database.

## Problem 6 — Product info and stock

### My prompt(s)

> I'm now on Problem 6: Product info and stock
>
> I want to give the agent tools to look up real information from campus_customs.db for the following:
> - Product description
> - Price
> - How many are in stock (by size when the customer asks)
>
> The agent should only use the database - it should never invent prices or quantities, and if a product or a size is out of stock, it should clearly say out of stock and maybe add a little banner across the product image for visual emphasis saying "Out of stock"
>
> I also want to expand prompts/prompt.md so the agent knows to call all of these tools for price and stock questions, and add or update return types in models.py. Finally, in output/harness.md, I want to list each tool and explain which model fields were chosen for the lookup results and why.

### Follow-up / what was lacking after the first prompt

No follow-up was needed. The agent now has `get_product_description`, `get_product_price`, and `check_stock` (plus `search_products`), each returning typed results. An output validator rejects any price or quantity that no tool returned, and "Out of stock" banners appear on product images in the grid, on the product page, and in chat.

## Problem 7 — Chat search that updates the page

### My prompt(s)

> I'm now on Problem 7: Chat search that updates the page
>
> When someone asks about a type of item such as "what hoodies do you have?" I want the agent to search the catalogue and have the website dynamically show the matching items as product cards like image, name, price, short info. This should be an API contract where the agent returns structured product matches and the frontend renders them on the website to look very sleek and professional.
>
> Once the dynamic product cards are loaded by this feature, confirm the same single-item page behavior built in problem 3 is still functioning so each prlduct card (including the ones the chat just put on the page) still opens the detail view with the large image and full information when clicked. Finally, update prompts/prompt.md and output/harness.md so it's clear how search results end up reaching the page.

### Follow-up / what was lacking after the first prompt

No follow-up was needed. A `show_products_on_page` tool now returns a typed `PageResults` contract in `ChatReply.page_results`. The Products page swaps to redesigned product cards for the chat's matches, and clicking any card, including chat-rendered ones, still opens the Problem 3 detail page.

## Problem 8 — Customer memory

### My prompt(s)

> Now I'm on Problem 8: Customer memory
>
> Once a customer's logged in, save their chat history in the database in a specific, appropriate table and reload it once they return so the agent knows who's chatting (by name and email) an put it in agent deps or an equivalent pattern and/or tools the agent can call. I also want to pass enough page context so if someone is on a Product Page and asks "do you have this in pink?" the agent can know which item they want. Guests will have the ability to chat with the bot without an account, but history should only save for logged-in users. Finally, document in output/harness.md how user chat history is stored, what customer fields the agent is seeing, and how each page context is passed.

### Follow-up / what was lacking after the first prompt

No follow-up was needed. Logged-in chats are saved to `chat_messages` and reloaded on return. A `CustomerContext` (name, email, member since, returning status) goes into `AgentDeps` and a `get_customer_profile` tool. A typed `PageContext` (page, product, selected size, results) is sent with every message, so "do you have this in pink?" resolves to the on-screen product. Guests can chat, but their chats are never saved.

## Problem 9 — Usability improvements

### My prompt(s)

> Now to Problem 9: Usability improvements
>
> I want you to do an end-to-end review of both the frontend and backend functionality. I want you to choose 2 frontend and 2 agent / backend usability inprovements and implement them. The frontend should make the site easier to use, the backend changes should make the agent output better and/or run faster or cheaper. Once you decide what the 4 total changes are, write output/usability.md as you build, and for each improvement describe what was added and why it helps either the Campus Customs shopper or he business itself. The changes should show up in the running app, and I want the write-up to be both qualitatitive AND quantitative so myself or someone else can read it and easily see how the 4 total improvements resulted in meaningful improvements to usability.

### Follow-up / what was lacking after the first prompt

No follow-up was needed. After a measured review (agent benchmark, search audit, and walkthrough), four improvements were built and documented in `output/usability.md`:
- smart search, filters, and sorting on the Products page;
- context-aware chat suggestion chips;
- fewer, cheaper model round trips;
- follow-up turns fixed (the system prompt had been missing on them), plus guarded page updates and stricter on-topic replies.

## Problem 10 — Style the website

### My prompt(s)

> Now on to problem 10: Style the website
>
> I want the website to look and feel like a real Campus Customs storefront with fonts, color, hierarchy, mnotion, product presentation, and chat feel. Search for a generic campus customs website for a baseline inspiration, then look at yale.edu's website for Yale specific logos, colors, branding, etc.
>
> To further customize and add motion, I want you to look at the following website (https://coralgardeners.org) and how they leverage motion while the user scrolls and how the images are incorporated into the website and mimic that functionality and sleek design. I want the chatbot to include a bulldog image like the one I just pasted and call the chat Dan

### Follow-up / what was lacking after the first prompt

> Also, write output/design.md and describe what was changed and how it can help potential shoppers stay on the website and purchase something. Keep it brief but descriptive

The first prompt didn't ask for a write-up of the redesign, so the follow-up added `output/design.md` explaining the changes and how they help shoppers stay and buy.

## Problem 11 — Site testing (app check)

### My prompt(s)

> I'm now on problem 11: Site testing (app check)
>
> I want to test the live site and document it in output/app_check.html (a page that can be opened with a double-click). Test the website, take screenshots as you go, and draft short captions for each of the following:
> 1. Chat checking the inventory level of an item (honest stock / price from the datbase)
> 2. The dynamic search-result cards appearing after a category question (e.g., hoodies)
> 3. One of the usability features that were added in Problem 9
>
> The HTML should be easy for graders to review and include a heading for each check, the screenshot you took, and a couple of sentences describing what the screenshots prove.
>
> I want the screenshot image files placed in output/app_check_images/ and link them from app_check.html with the relative paths (e.g., app_check_images/inventory.png)

### Follow-up / what was lacking after the first prompt

No follow-up was needed. The live site was tested as a guest in headless Chrome, and `output/app_check.html` documents three passing checks with five screenshots in `output/app_check_images/`:
- Dan's stock and price answers matched the database;
- "What hoodies do you have?" put 27 cards on the page, and a result card opened its detail page;
- the Problem 9 search and filters worked.

The test also surfaced a transient network error, which was fixed and re-tested.

## Problem 12 — Audit trail, safety, finish harness

### My prompt(s)

> Now on to Problem 12: Audit trail, safety, finish harness
>
> I want to keep an append-only output/audit_trail.json of agent-loop activity including time, tool name, short args/result, and stop reason. I don't want it to wipe between runs, and I want you to create some safety rules to give the agent and put them into prompts/prompt.md.
>
> Then, finish output/harness.md so it's clear how the system works for anyone to review. I want you to include the following:
> - Model fields in models.py and why you chose them
> - Tools and abilities
> - Safety rules
> - Specs (including loop limits, result caps, models, and how to run front and back)

### Follow-up / what was lacking after the first prompt

No follow-up was needed. Every chat turn now appends one entry per agent-loop step to `output/audit_trail.json`. The file is truly append-only, locked, and redacted, and it survives server restarts. `prompts/prompt.md` gained ten numbered safety rules (S1–S10), which passed a 10/10 red-team check. `output/harness.md` now opens with a complete system reference: architecture, how to run, specs, tools, model fields, safety, audit, and routes.

## Problem 13 — Push to GitHub and submit the URL

### My prompt(s)

> Now I'm on Problem 13: Push to GitHub and submit the URL
>
> I want to put the code in a folder named hw4 and push it to a public GitHub repository (my joel.thomas@yale.edu account). It should have the expected layout in the image.
>
> The agent is 4 files under backend/: prompts/prompt.md, agent.py, tools.py, and models.py. Finally, README.md should explain how to run the frontend and backend after placing the data pack

### Follow-up / what was lacking after the first prompt

No follow-up was needed. The project was copied into a clean `hw4/` folder with the expected layout. The data pack, `.env`, virtualenv, `node_modules`, and session secret are excluded by `.gitignore`. `README.md` was added with data-pack placement and frontend/backend run steps. The repo was verified from a fresh clone and pushed to a public GitHub repository.
