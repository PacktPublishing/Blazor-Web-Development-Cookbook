namespace BlazorCookbook.App.Client.Chapters.Chapter05.Recipe07;

public sealed class CartState
{
    public DateTime UpdateTime { get; set; }
    public void Add() => UpdateTime = DateTime.UtcNow;
}
