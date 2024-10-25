using Chapter02 = BlazorCookbook.App.Client.Chapters.Chapter02;
using Chapter04 = BlazorCookbook.App.Client.Chapters.Chapter04;
using Chapter05 = BlazorCookbook.App.Client.Chapters.Chapter05;
using Chapter06 = BlazorCookbook.App.Client.Chapters.Chapter06;

using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);

// CHAPTER 02

builder.Services.AddTransient<Chapter02.Data.SuggestionsApi>();

// CHAPTER 04

builder.Services.AddScoped<Chapter04.Data.TicketsApi>();

// CHAPTER 05

builder.Services.AddScoped<Chapter05.Data.Api>();
builder.Services.AddScoped<Chapter05.Recipe02.StateContainer<Chapter05.Data.Event>>();
builder.Services.AddScoped<Chapter05.Recipe03.StoreState>();
builder.Services.AddScoped<Chapter05.Recipe04.OverlayState>();
builder.Services.AddScoped<Chapter05.Recipe05.BrowserStorage>();
builder.Services.AddScoped<Chapter05.Recipe06.BrowserStorage>();
builder.Services.AddScoped<Chapter05.Recipe07.BrowserStorage>();
builder.Services.AddCascadingValue(it => new Chapter05.Recipe07.CartState());

// CHAPTER 06

builder.Services.AddTransient<Chapter06.Data.FileStorage>();

await builder.Build().RunAsync();
