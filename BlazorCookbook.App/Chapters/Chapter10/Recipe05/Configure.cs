using Azure.AI.OpenAI;
using Azure.AI.OpenAI.Chat;
using OpenAI.Chat;

namespace BlazorCookbook.App.Chapters.Chapter10.Recipe05;

#pragma warning disable AOAI001
internal static class Configure
{
    public static WebApplicationBuilder EnhanceChatBotWithExistingData(this WebApplicationBuilder builder)
    {
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

        return builder;
    }
}
