using BlazorCookbook.App.Client;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);

builder.Services.ConfigureRecipe03()
                .ConfigureRecipe04()
                .ConfigureRecipe06();

await builder.Build().RunAsync();
