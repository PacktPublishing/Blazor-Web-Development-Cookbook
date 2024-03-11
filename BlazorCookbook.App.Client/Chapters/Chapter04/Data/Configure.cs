namespace BlazorCookbook.App.Client.Chapters.Chapter04.Data;

internal static class Configure
{
    public static IServiceCollection AddChapter04(this IServiceCollection services)
    {
        services.AddTransient<Tickets.Service>();
        return services;
    }
}
