using BlazorCookbook.App.Client.Chapters.Chapter02.Data;

namespace BlazorCookbook.App.Client.Chapters.Chapter02;

internal static class Configure
{
    public static IServiceCollection AddChapter02(this IServiceCollection services)
    {
        services.AddTransient<SuggestionsApi>();
        return services;
    }
}
