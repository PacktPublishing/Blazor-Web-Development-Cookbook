### Adding a ChatBot

Everything concerning connection with Azure OpenAI should not be parked on the client-side.
Hence why, you'll find the bot implementation on the server-side, in a matching directory: /Chapters/Chapter10/Recipe04

If you choose to have the ChatBot component on the client-side,
you must decouple the Azure OpenAI connection logic into a service that you'll still keep on the server-side.

Have fun!