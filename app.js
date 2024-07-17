const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
require("dotenv").config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

async function interact(chatId, request) {
  console.log("Calling interact function");
  console.log("Chat ID:", chatId);
  console.log("Request:", JSON.stringify(request, null, 2));

  try {
    const response = await axios({
      method: "POST",
      url: `https://general-runtime.voiceflow.com/state/user/${chatId}/interact`,
      headers: {
        Authorization: process.env.VOICEFLOW_API_KEY,
      },
      data: {
        request,
      },
    });
    var res = JSON.stringify(response.data);
    console.log(res);
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
          console.log("choice reached");
          const buttons = trace.payload.buttons.map((button) => {
            if (
              button.request.payload.actions &&
              button.request.payload.actions.length > 0
            ) {
              // Check if there's an action of type "open_url"
              const urlAction = button.request.payload.actions.find(
                (action) => action.type === "open_url"
              );
              if (urlAction) {
                // Handle URL action
                let url = urlAction.payload.url;
                if (url.startsWith("mailto:")) {
                  const mailId = url.slice(7);
                  console.log(mailId);
                  url = `https://mail.google.com/mail/?view=cm&fs=1&to=${mailId}`;
                }
                return [{ text: button.name, url: url }];
              }
            }

            // Handle intent type buttons
            else if (button.request.type === "intent") {
              console.log("reached intent");
              console.log("button name:" + button);
              return [
                {
                  text: button.request.payload.label,
                  callback_data: button.request.payload.intent.name,
                },
              ];
            } else {
             

              return [{ text: button.name, callback_data: button.request.type }];
            }
          });

          await bot.sendMessage(chatId, "Please choose an option:", {
            reply_markup: {
              inline_keyboard: buttons,
            },
          });

          break;

         

          case "carousel":
            const cards = trace.payload.cards;
  
            for (const card of cards) {
              const buttons = card.buttons.map((button) => ({
                text: button.name,
                url: button.request.payload.actions[0].payload.url,
              }));
  
              await bot.sendPhoto(chatId, card.imageUrl, {
                caption: `${card.title}\n\n${card.description.text}`,
                reply_markup: {
                  inline_keyboard: [buttons],
                },
              });
            }
            break;


        // case "path":
        //   if (trace.payload.path === "reprompt") {
        //     await bot.sendMessage(chatId, "Please provide more information:");
        //   }else if(trace.payload.path==="capture"){
        //     request = {
        //       type:"path",
        //       payload:{
        //         path:"capture"
              
        //       }
        //     }
        //     await interact(chatId, request);
        //   }
        //   break;
      }
    }
  } catch (error) {
    console.error("Error interacting with Voiceflow:", error);
  }
}

bot.on("callback_query", async (callbackQuery) => {
  
  console.log("reached callback");
  
  const chatId = callbackQuery.message.chat.id;
  const action = callbackQuery.data;
//   // console.log(callbackQuery)
//   // // const callbackquer=JSON.stringify(callbackQuery)
//   // console.log(callbackQuery.message.reply_markup.inline_keyboard.find((item)=>item.name=callbackQuery.data))
//   // console.log(callbackQuery.message.reply_markup.inline_keyboard[0][0])
// // console.log(JSON.stringify(callbackquer))
  let request;

  if (action === 'No') {
    request = {
      type: 'path',
      payload: {
        path: action,
        action:[]
      }
    };
  }
  else if(action.startsWith('path')){
    console.log("reachedddddddddddd")
  
    request = {
      type:action,
      payload:{
        path:callbackQuery.message.reply_markup.inline_keyboard[0][0].text
      
      }
    }
  } 
  else {
    request = {
      type: "intent",
      payload: {
        query: action, // Adjust to pass relevant data from the button action
        label: action, // Optional: Provide a label if needed
        intent: {
          name: action, // Adjust based on your Voiceflow intent structure
        },
        actions: [], // Adjust based on any additional actions needed
        entities: [], // Adjust based on any entities needed
      },
    };
  }

  try {
    await interact(chatId, request);
    bot.answerCallbackQuery(callbackQuery.id);
  } catch (error) {
    console.error("Error processing callback query:", error);
  }
});

// Handle /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await interact(chatId, { type: "launch" });
});

// Handle any text messages
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (msg.text) {
    await interact(chatId, {
      type: "text",
      payload: msg.text,
    });
  }
});

process.once("SIGINT", () => bot.stopPolling());
process.once("SIGTERM", () => bot.stopPolling());
