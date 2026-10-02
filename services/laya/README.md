# Laya (task complexity)

[Laya](https://github.com/NandhaKishorM/laya) is a small open-weight decision model (Apache 2.0,
~421M parameters) that runs locally. The planner (`server/src/planning/complexity.ts`) asks it how
demanding each pending task is, using a 5-level score. That score becomes the task's 1-10
complexity. With it, Gemini puts demanding tasks in morning blocks and the validator puts the
hardest task first inside a block.

It runs **zero-shot**, without fine-tuning on this user's tasks, so its scores are coarse: they
rank tasks in a sensible order, but most land in the middle of the scale. Fine-tuning on graded
examples is what would spread them out. Laya only classifies; it doesn't write plans.

## Setup (once)

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
```

The first start downloads the multilingual checkpoint from Hugging Face (~1.5 GB) into the
Hugging Face cache.

## Run

```powershell
.\start.ps1   # http://127.0.0.1:8100
```

Then set `LAYA_URL=http://127.0.0.1:8100` in `server/.env`. If `LAYA_URL` is unset, or Laya is
down, planning still works: it uses the complexity stored on each task and says so in the
proposal's `warnings`.
