using BlazorCookbook.App.Chapters.Chapter10.Recipe04;
using BlazorCookbook.App.Chapters.Chapter10.Recipe05;
using BlazorCookbook.App.Client;
using BlazorCookbook.App.Configuration;
using BlazorCookbook.Library.Chapter09.Recipe01;
using SmartComponents.Inference.OpenAI;

using Chapter02 = BlazorCookbook.App.Client.Chapters.Chapter02;
using Chapter04 = BlazorCookbook.App.Client.Chapters.Chapter04;
using Chapter05 = BlazorCookbook.App.Client.Chapters.Chapter05;
using Chapter06 = BlazorCookbook.App.Client.Chapters.Chapter06;

var builder = WebApplication.CreateBuilder(args);

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

// for clarity, DI configuration for Chapter 10 / Recipe 04 is hidden within AddChatBot()
// feel free to comment it out
builder.AddChatBot();

// for clarity, DI configuration for Chapter 10 / Recipe 05 is hidden within EnhanceChatBotWithExistingData()
// feel free to comment it out
builder.EnhanceChatBotWithExistingData();

builder.Services
       .AddSmartComponents()
       .WithInferenceBackend<OpenAIInferenceBackend>();

builder.Services
       .AddRazorComponents()
       .AddInteractiveServerComponents()
       .AddInteractiveWebAssemblyComponents();


var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseWebAssemblyDebugging();
}
else
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();
app.UseAntiforgery();

app.UseStatusCodePagesWithRedirects("/error");

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode()
    .AddInteractiveWebAssemblyRenderMode()
    .AddAdditionalAssemblies(
        typeof(_Imports).Assembly,
        typeof(ExternalEventManager).Assembly
    );

app.Run();
