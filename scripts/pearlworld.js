console.log("pf2e-pearlworld | Welcome to Pearl World!");

// Send message when game is ready
Hooks.once("ready", () => {
    ChatMessagePF2e.create({ content: "Welcome to Pearl World!", speaker: { alias: "Steve" }});
});

