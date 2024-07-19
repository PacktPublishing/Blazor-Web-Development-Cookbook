using BlazorCookbook.App.Chapters.Chapter10.Recipe04;
using BlazorCookbook.App.Chapters.Chapter10.Recipe05;
using BlazorCookbook.App.Client;
using BlazorCookbook.App.Configuration;
using BlazorCookbook.Library.Chapter09.Recipe01;
using SmartComponents.Inference.OpenAI;

var builder = WebApplication.CreateBuilder(args);

// for clarity, DI configuration for Chapter 10 / Recipe 04 is hidden within AddChatBot()
// feel free to comment it out
builder.AddChatBot();

// for clarity, DI configuration for Chapter 10 / Recipe 05 is hidden within EnhanceChatBotWithExistingData()
// feel free to comment it out
builder.EnhanceChatBotWithExistingData();

builder.Services.AddChapters();

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
