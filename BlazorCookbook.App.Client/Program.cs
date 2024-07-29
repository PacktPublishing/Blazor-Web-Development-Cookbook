using BlazorCookbook.App.Client;

using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);

// service registrations are encapsulated in the AddChapters extension method
// for clarity and easier navigation
builder.Services.AddChapters();

await builder.Build().RunAsync();
