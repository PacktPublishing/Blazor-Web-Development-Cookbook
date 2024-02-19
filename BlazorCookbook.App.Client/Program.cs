using BlazorCookbook.App.Client;
using BlazorCookbook.App.Client.Chapters.Chapter03.Recipe07;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);

builder.Services.ConfigureRecipe03()
                .ConfigureRecipe04()
                .ConfigureRecipe06()
                .AddApiClientForChapter03Recipe07();

await builder.Build().RunAsync();
