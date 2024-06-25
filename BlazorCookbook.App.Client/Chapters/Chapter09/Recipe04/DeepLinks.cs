namespace BlazorCookbook.App.Client.Chapters.Chapter09.Recipe04;

public static class DeepLinks
{
    public const string
        LandingPage = "/ch09r04",
        WithTicketPage = "/ch09r04/{ticketId:guid}",
        WithTicketAtVenuePage = "/ch09r04/{ticketId:guid}/venues/{venue?}";
}
