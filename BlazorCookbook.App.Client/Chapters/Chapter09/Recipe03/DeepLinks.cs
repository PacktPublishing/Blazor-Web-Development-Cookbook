namespace BlazorCookbook.App.Client.Chapters.Chapter09.Recipe03;

public static class DeepLinks
{
    public const string
        LandingPage = "/ch09r03",
        WithTicketPage = "/ch09r03/{ticketId:guid}",
        WithTicketAtVenuePage = "/ch09r03/{ticketId:guid}/venues/{venue?}";
}
