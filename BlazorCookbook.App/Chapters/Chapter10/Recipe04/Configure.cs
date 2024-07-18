using Azure.AI.OpenAI;
using Azure;
using OpenAI.Chat;

namespace BlazorCookbook.App.Chapters.Chapter10.Recipe04;

internal static class Configure
{
    public static WebApplicationBuilder AddChatBot(this WebApplicationBuilder builder)
    {    
        var endpoint = builder.Configuration["ChatBot:Endpoint"];
        var apiKey = builder.Configuration["ChatBot:ApiKey"];
        var deploymentName = builder.Configuration["ChatBot:DeploymentName"];

        builder.Services.AddSingleton(new AzureOpenAIClient(
            new Uri(endpoint), new AzureKeyCredential(apiKey)));

        builder.Services.AddScoped(services =>
        {
            var openAI = services.GetRequiredService<AzureOpenAIClient>();
            return openAI.GetChatClient(deploymentName);
        });

        return builder;
    }
}
