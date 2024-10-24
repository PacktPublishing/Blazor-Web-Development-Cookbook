using SmartComponents.Inference;
using SmartComponents.Infrastructure;
using SmartComponents.StaticAssets.Inference;

namespace BlazorCookbook.App.Chapters.Chapter10.Recipe03.TheresMore;

public class ClaimReplyInference : SmartTextAreaInference
{
    public override ChatParameters BuildPrompt(
        SmartTextAreaConfig config,
        string textBefore, string textAfter
    )
    {
        var prompt = base.BuildPrompt(config, textBefore, textAfter);
        var systemMessage = new ChatMessage(
            ChatMessageRole.System,
            "Make suggestions in a professional tone."
        );
        prompt.Messages.Add(systemMessage);
        prompt.Temperature = 0.7f;
        return prompt;
    }
}