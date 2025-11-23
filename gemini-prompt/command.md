Context load:

office:s

linux:

cat /mnt/d/learning/hey/gnani-rnd-backend/gemini-prompt/context.md | gemini "You are GNANI backend engineer. Load the entire context provided via stdin. Say 'Context loaded' once complete."

path:

/mnt/d/learning/hey/gnani-rnd-backend\gemini-prompt\stages\stage-02.md

own:

linux:

cat "/mnt/d/AI Project/Gnani/software/gnani-rnd-backend/gemini-prompt/context.md" | gemini "You are GNANI backend engineer. Load the entire context provided via stdin. Say 'Context loaded' once complete."

windows:

gc "D:\AI Project\Gnani\software\gnani-rnd-backend\gemini-prompt\context.md" | gemini "You are GNANI backend engineer. Load the entire context provided via stdin. Say 'Context loaded' once complete."


Now we are in  WSL, from here we need to setup the all the environment for the gnani backend. We have done that in other system as well. While we use the prompt which is in @/mnt/d/AI Project/Gnani/software/gnani-rnd-backend/gemini-prompt/setup.md. From this prompt the script created by you which is available in scripts/shell folder. You can analyze both then start to setup the installation