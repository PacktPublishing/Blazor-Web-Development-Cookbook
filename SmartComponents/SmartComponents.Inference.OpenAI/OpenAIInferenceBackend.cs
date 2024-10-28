// Licensed to the .NET Foundation under one or more agreements.
// The .NET Foundation licenses this file to you under the MIT license.

using System;
using System.ClientModel;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using OpenAI;
using OpenAIInternal = OpenAI.Chat;
using SmartComponents.StaticAssets.Inference;
using Azure.AI.OpenAI;

namespace SmartComponents.Inference.OpenAI;

public class OpenAIInferenceBackend(IConfiguration configuration)
    : IInferenceBackend
{
    public async Task<string> GetChatResponseAsync(ChatParameters options)
    {
#if DEBUG
        if (ResponseCache.TryGetCachedResponse(options, out var cachedResponse))
        {
            return cachedResponse!;
        }
#endif

        var apiConfig = new ApiConfig(configuration);
        var client = CreateClient(apiConfig);
        var chat = client.GetChatClient(apiConfig.DeploymentName);

        var chatCompletionsOptions = new OpenAIInternal.ChatCompletionOptions
        {
            Temperature = options.Temperature ?? 0f,
            MaxOutputTokenCount = options.MaxTokens ?? 200,
            TopP = options.TopP ?? 1,
            FrequencyPenalty = options.FrequencyPenalty ?? 0,
            PresencePenalty = options.PresencePenalty ?? 0,

            ResponseFormat = options.RespondJson
                ? OpenAIInternal.ChatResponseFormat.CreateJsonObjectFormat()
                : OpenAIInternal.ChatResponseFormat.CreateTextFormat()
        };

        var messages = new List<OpenAIInternal.ChatMessage>();
        foreach (var message in options.Messages ?? [])
        {
            messages.Add(message.Role switch
            {
                ChatMessageRole.System => new OpenAIInternal.SystemChatMessage(message.Text),
                ChatMessageRole.User => new OpenAIInternal.UserChatMessage(message.Text),
                ChatMessageRole.Assistant => new OpenAIInternal.AssistantChatMessage(message.Text),
                _ => throw new InvalidOperationException($"Unknown chat message role: {message.Role}")
            });
        }

        if (options.StopSequences is { } stopSequences)
        {
            foreach (var stopSequence in stopSequences)
            {
                chatCompletionsOptions.StopSequences.Add(stopSequence);
            }
        }

        var completionsResponse = await chat.CompleteChatAsync(messages, chatCompletionsOptions);
        var response = completionsResponse.Value.Content.FirstOrDefault()?.Text ?? string.Empty;

#if DEBUG
        ResponseCache.SetCachedResponse(options, response);
#endif

        return response;
    }

    private static OpenAIClient CreateClient(ApiConfig apiConfig)
    {
        if (apiConfig.Endpoint is null)
        {
            // OpenAI
            return new OpenAIClient(apiConfig.ApiKey);
        }
        else
        {
            // Azure OpenAI
            return new AzureOpenAIClient(apiConfig.Endpoint,
                new ApiKeyCredential(apiConfig.ApiKey!));
        }
    }
}
