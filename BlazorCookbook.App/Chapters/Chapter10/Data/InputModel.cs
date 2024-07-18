namespace BlazorCookbook.App.Chapters.Chapter10.Data;

public class InputModel
{
    public string Value { get; set; }

    public bool IsValid
        => !string.IsNullOrWhiteSpace(Value);
};