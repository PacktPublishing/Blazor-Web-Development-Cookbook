using BlazorCookbook.App.Client;

using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);

builder.Services.AddChapters();

await builder.Build().RunAsync();
