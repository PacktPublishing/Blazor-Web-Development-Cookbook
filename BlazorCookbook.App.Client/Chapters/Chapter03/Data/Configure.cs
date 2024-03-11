namespace BlazorCookbook.App.Client.Chapters.Chapter03.Data;

internal static class Configure
{
    public static IServiceCollection AddChapter03(this IServiceCollection services)
    {
        services.AddTransient<Recipe07.ApiClient>();

        return services;
    }
}
