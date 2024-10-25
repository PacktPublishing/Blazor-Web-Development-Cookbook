namespace BlazorCookbook.App.Client.Chapters.Chapter09.Recipe08;

public static class DeepLinks
{
    public const string
        LandingPage = "/ch09r08",
        EventPage = "/ch09r08/{eventId:guid}",
        EventAtVenuePage = "/ch09r08/{eventId:guid}/venues/{venue?}";
}
