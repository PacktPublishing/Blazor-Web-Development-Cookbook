namespace BlazorCookbook.App.Client.Chapters.Chapter01.Recipe05.Models;

public static class Data
{
    public static readonly TicketViewModel
        Adult = new("Adult", 10.00m),
        FreeAdmission = new("Free Admission", 0.00m),
        Elderly = new("Elderly", 8.00m);
}
