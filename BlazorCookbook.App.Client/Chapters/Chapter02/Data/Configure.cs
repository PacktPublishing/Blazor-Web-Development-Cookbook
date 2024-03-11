namespace BlazorCookbook.App.Client.Chapters.Chapter02.Data;

internal static class Configure
{
    public static IServiceCollection AddChapter02(this IServiceCollection services)
    {
        services.AddTransient<Recipe03.Data.SuggestionsApi>()
                .AddTransient<Recipe04.Data.SuggestionsApi>()
                .AddTransient<Recipe06.Data.SuggestionsApi>();

        return services;
    }
}
