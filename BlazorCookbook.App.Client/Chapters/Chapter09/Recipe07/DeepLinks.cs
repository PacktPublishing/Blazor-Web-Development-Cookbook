namespace BlazorCookbook.App.Client.Chapters.Chapter09.Recipe07;

public static class DeepLinks
{
    public const string
        LandingPage = "/ch09r07",
        EventPage = "/ch09r07/{eventId:guid}",
        EventAtVenuePage = "/ch09r07/{eventId:guid}/venues/{venue?}";
}
