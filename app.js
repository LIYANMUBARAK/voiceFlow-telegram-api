const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });


// Function to handle interaction with Voiceflow
async function interact(chatId, request) {
    try {
        const response = await axios({
            method: "POST",
            url: `https://general-runtime.voiceflow.com/state/user/${chatId}/interact`,
            headers: {
                Authorization: process.env.VOICEFLOW_API_KEY
            },
            data: {
                request
            }
        });

        for (const trace of response.data) {
            switch (trace.type) {
                case "text":
                case "speak":
                    await bot.sendMessage(chatId, trace.payload.message);
                    break;
                case "visual":
                    await bot.sendPhoto(chatId, trace.payload.image);
                    break;
                case "end":
                    await bot.sendMessage(chatId, "Conversation is over");
                    break;
                case "choice":
                    const buttons = trace.payload.buttons.map(button => {
                        const action = button.request.payload.actions[0];
                        if (action.type === "open_url") {
                            return [{ text: button.name, url: action.payload.url }];
                        } else {
                            return [{ text: button.name, callback_data: button.name }];
                        }
                    });

                    await bot.sendMessage(chatId, "Please choose an option:", {
                        reply_markup: {
                            inline_keyboard: buttons
                        }
                    });
                    break;
                case "knowledgeBase":
                    // Extract and handle URLs from knowledgeBase trace
                    const chunks = trace.payload.chunks;
                    const urlButtons = chunks.map(chunk => ({
                        text: chunk.documentData.name,
                        url: chunk.documentData.url
                    }));

                    await bot.sendMessage(chatId, "Here are some links for you:", {
                        reply_markup: {
                            inline_keyboard: urlButtons.map(button => [{ text: button.text, url: button.url }])
                        }
                    });
                    break;
                case "path":
                    // Handle different paths based on trace.payload.path
                    if (trace.payload.path === "reprompt") {
                        await bot.sendMessage(chatId, "Please provide more information:");
                    }
                    break;
                default:
                    console.log("Unhandled trace type:", trace.type);
                    break;
            }
        }
    } catch (error) {
        console.error("Error interacting with Voiceflow:", error);
    }
}

// Handle button actions
bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const action = callbackQuery.data;

    let request = {
        type: 'choice',
        payload: {
            selected: action
        }
    };
    await interact(chatId, request);
    bot.answerCallbackQuery(callbackQuery.id);
});

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await interact(chatId, { type: "launch" });
});

// Handle any text messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (msg.text) {
        await interact(chatId, {
            type: "text",
            payload: msg.text
        });
    }
});

// Stop the bot gracefully on SIGINT and SIGTERM
process.once('SIGINT', () => bot.stopPolling());
process.once('SIGTERM', () => bot.stopPolling());
