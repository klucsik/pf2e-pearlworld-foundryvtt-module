async function draconicAuthority() {

    const actor = _token.actor;

    // Check prerequisite: trained in Diplomacy or Intimidation
    const diplomacy = actor.skills.diplomacy;
    const intimidation = actor.skills.intimidation;
    if (diplomacy.rank == 0 && intimidation.rank == 0) {
        ui.notifications.error("You must be trained in Diplomacy or Intimidation.");
        return;
    }

    // Get target
    const targets = game.user.targets;
    if (targets.size !== 1) {
        ui.notifications.error("Select exactly one target.");
        return;
    }
    const targetToken = targets.first();
    const target = targetToken?.actor;
    if (!target || !target.isOfType("creature")) {
        ui.notifications.error("Invalid target.");
        return;
    }

    // Check if ally (same alliance)
    if (actor.system.details.alliance !== target.system.details.alliance) {
        ui.notifications.error("Target must be an ally.");
        return;
    }

    // Check distance (30 feet)
    const distance = canvas.grid.measureDistance(actor.getActiveTokens()[0]?.center, targetToken.center);
    if (distance > 30) {
        ui.notifications.error("Target is too far away (must be within 30 feet).");
        return;
    }

    // Check immunity
    if (target.items.some(i => i.slug === "draconic-authority-immunity")) {
        ui.notifications.error("Target is immune to Draconic Authority.");
        return;
    }

    // Determine available skills
    const skills = [];
    if (diplomacy.proficient) skills.push({ value: "diplomacy", label: "Diplomacy" });
    if (intimidation.proficient) skills.push({ value: "intimidation", label: "Intimidation" });

    // Check if expert for confusion
    const canCounteractConfusion = diplomacy.rank >= 2 || intimidation.rank >= 2;

    // Dialog
    const dialog = new foundry.appv1.api.Dialog({
        title: "Draconic Authority",
        content: `
        <form>
        <div class="form-group">
        <label>Skill</label>
        <select name="skill">
        ${skills.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
        </select>
        </div>
        <div class="form-group">
        <label>Target Condition</label>
        <select name="condition" id="condition-select">
        <option value="frightened">Frightened</option>
        ${canCounteractConfusion ? '<option value="confusion">Confusion</option>' : ''}
        </select>
        </div>
        <div class="form-group" id="counteract-group" style="display: none;">
        <label>Counteract DC</label>
        <input type="number" name="counteractDC" min="1" max="50" value="15" />
        <label>Counteract Rank of target effect</label>
        <input type="number" name="counteractRank" min="1" max="10" value="1" />
        </div>
        </form>
        <script>
        document.getElementById('condition-select').addEventListener('change', function() {
            const group = document.getElementById('counteract-group');
            group.style.display = this.value === 'confusion' ? 'block' : 'none';
        });
        </script>
        `,
        buttons: {
            yes: {
                label: "Speak with Authority",
                callback: (html) => performCheck(html, actor, target),
            },
            no: {
                label: "Cancel",
            },
        },
        default: "yes",
    });
    dialog.render(true);
}

async function performCheck(html, actor, target) {
    const skillSlug = html.find('[name="skill"]').val();
    const condition = html.find('[name="condition"]').val();
    const counteractDC = parseInt(html.find('[name="counteractDC"]').val()) || 15;
    const counteractRankOfTarget = parseInt(html.find('[name="counteractRank"]').val()) || 1;
    const skill = actor.skills[skillSlug];
    let dc = target.saves.will.dc.value;
    if (condition === "confusion") {
        dc = counteractDC;
    }

    await skill.check.roll({
        dc: { value: dc },
        extraRollOptions: ["action:draconic-authority"],
        callback: async (roll, outcome, message) => {
            // Create immunity effect for 1 hour
            const effectSource = {
                type: "effect",
                name: "Draconic Authority Immunity",
                img: "icons/skills/social/intimidation-impressing.webp",
                system: {
                    slug: "draconic-authority-immunity",
                    description: { value: "Immune to Draconic Authority for 1 hour." },
                    duration: {
                        value: 1,
                        unit: "hours",
                    },
                    rules: [],
                },
            };
            await target.createEmbeddedDocuments("Item", [effectSource]);

            let success = false;
            let amount = 0;
            if (outcome === "criticalSuccess") {
                success = true;
                amount = 2;
            } else if (outcome === "success") {
                success = true;
                amount = 1;
            }

            if (success) {
                if (condition === "frightened") {
                    await target.decreaseCondition("frightened", { value: amount });
                    await ChatMessage.create({
                        content: `Draconic Authority succeeded! Reduced frightened by ${amount}.`,
                        speaker: ChatMessage.getSpeaker({ actor }),
                    });
                } else if (condition === "confusion") {
                    await skill.check.roll({ // make new roll for counteract
                        dc: { value: counteractDC },
                        extraRollOptions: ["action:draconic-authority-counteract"],
                        callback: async (counteractRoll, counteractOutcome, counteractMessage) => {
                            const selfRank = Math.ceil(actor.system.details.level.value/2);
                            let messageText = "";
                            let counteracts = false;
                            if (counteractOutcome === "criticalSuccess") {
                                messageText = "*Critical Success:* Counteract the target if its counteract rank is no more than 3 higher than your effect's counteract rank.";
                                if (counteractRankOfTarget <= selfRank + 3) {counteracts = true};
                            } else if (counteractOutcome === "success") {
                                messageText = "**Success:** Counteract the target if its counteract rank is no more than 1 higher than your effect's counteract rank.";
                                if (counteractRankOfTarget <= selfRank + 1) {counteracts = true;};
                            } else if (counteractOutcome === "failure") {
                                messageText = "Failure: Counteract the target if its counteract rank is lower than your effect's counteract rank.";
                                if (counteractRankOfTarget < selfRank) {counteracts = true;};
                            } else if (counteractOutcome === "criticalFailure") {
                                messageText = "Critical Failure: You fail to counteract the target.";
                                counteracts = false;
                            }

                            if (counteracts) {
                                await target.decreaseCondition("confused", { value: 1 });
                            }
                            await ChatMessage.create({
                                content: `Draconic Authority counteract attempt: ${messageText}\r${counteracts ? `Reduced confused by 1.` : `Did not reduce confused.`}`,
                                speaker: ChatMessage.getSpeaker({ actor }),
                            });
                        }
                    });
                }
            } else {
                await ChatMessage.create({
                    content: "Draconic Authority failed.",
                    speaker: ChatMessage.getSpeaker({ actor }),
                });
            }
        },
    });
}

draconicAuthority();