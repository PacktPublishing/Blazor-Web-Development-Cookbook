using Azure.AI.OpenAI.Chat;
using BlazorCookbook.App.Client;
using BlazorCookbook.App.Configuration;
using BlazorCookbook.Library.Chapter09.Recipe01;
using OpenAI.Chat;
using SmartComponents.Inference.OpenAI;
using Chapter02 = BlazorCookbook.App.Client.Chapters.Chapter02;
using Chapter04 = BlazorCookbook.App.Client.Chapters.Chapter04;
using Chapter05 = BlazorCookbook.App.Client.Chapters.Chapter05;
using Chapter06 = BlazorCookbook.App.Client.Chapters.Chapter06;

#pragma warning disable AOAI001

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

// CHAPTER 10

builder.Services
       .AddSmartComponents()
       .WithInferenceBackend<OpenAIInferenceBackend>();

// recipe 04

var endpoint = builder.Configuration["ChatBot:Endpoint"];
var apiKey = builder.Configuration["ChatBot:ApiKey"];
var deploymentName = builder.Configuration["ChatBot:DeploymentName"];

builder.Services.AddSingleton(new Azure.AI.OpenAI.AzureOpenAIClient(
    new Uri(endpoint), new System.ClientModel.ApiKeyCredential(apiKey)));

builder.Services.AddScoped(services =>
{
    var openAI = services.GetRequiredService<Azure.AI.OpenAI.AzureOpenAIClient>();
    return openAI.GetChatClient(deploymentName);
});

// recipe 05

var searchEndpoint = builder.Configuration["Search:Endpoint"];
var searchApiKey = builder.Configuration["Search:ApiKey"];
var searchIndex = builder.Configuration["Search:Index"];

builder.Services.AddSingleton(services =>
{
    var dataSource = new AzureSearchChatDataSource
    {
        Endpoint = new Uri(searchEndpoint),
        IndexName = searchIndex,
        Authentication = DataSourceAuthentication.FromApiKey(searchApiKey)
    };

    ChatCompletionOptions completionOptions = new();
    completionOptions.AddDataSource(dataSource);
    return completionOptions;
});

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
